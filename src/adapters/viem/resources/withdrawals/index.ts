// src/adapters/viem/resources/withdrawals/index.ts
import type { ViemClient } from '../../client';
import type {
  WithdrawParams,
  WithdrawQuote,
  WithdrawPlan,
  WithdrawHandle,
  WithdrawalWaitable,
  WithdrawRoute,
  WithdrawalStatus,
  FinalizeDepositParams,
} from '../../../../core/types/flows/withdrawals';
import type { Address, Hex } from '../../../../core/types/primitives';
import type {
  Abi,
  EstimateContractGasParameters,
  TransactionReceipt,
  WriteContractParameters,
} from 'viem';

import { commonCtx } from './context';
import { toZKsyncError, createErrorHandlers } from '../../errors/error-ops';
import { createError } from '../../../../core/errors/factory';
import type {
  WithdrawRouteStrategy,
  TransactionReceiptZKsyncOS,
  ViemPlanWriteRequest,
} from './routes/types';
import { routeEth } from './routes/eth';
import { routeErc20 } from './routes/erc20';
import { createFinalizationServices, type FinalizationServices } from './services/finalization';
import { OP_WITHDRAWALS } from '../../../../core/types/errors';
import type { ReceiptWithL2ToL1 } from '../../../../core/rpc/types';

// --------------------
// Route map
// --------------------
const ROUTES: Record<WithdrawRoute, WithdrawRouteStrategy> = {
  eth: routeEth(),
  erc20: routeErc20(),
};

export interface WithdrawalsResource {
  quote(p: WithdrawParams): Promise<WithdrawQuote>;
  tryQuote(
    p: WithdrawParams,
  ): Promise<{ ok: true; value: WithdrawQuote } | { ok: false; error: unknown }>;

  prepare(p: WithdrawParams): Promise<WithdrawPlan<ViemPlanWriteRequest>>;
  tryPrepare(
    p: WithdrawParams,
  ): Promise<
    { ok: true; value: WithdrawPlan<ViemPlanWriteRequest> } | { ok: false; error: unknown }
  >;

  create(p: WithdrawParams): Promise<WithdrawHandle<ViemPlanWriteRequest>>;
  tryCreate(
    p: WithdrawParams,
  ): Promise<
    { ok: true; value: WithdrawHandle<ViemPlanWriteRequest> } | { ok: false; error: unknown }
  >;

  status(h: WithdrawalWaitable | Hex): Promise<WithdrawalStatus>;

  wait(
    h: WithdrawalWaitable | Hex,
    opts: { for: 'l2' | 'ready' | 'finalized'; pollMs?: number; timeoutMs?: number },
  ): Promise<TransactionReceiptZKsyncOS | TransactionReceipt | null>;

  finalize(l2TxHash: Hex): Promise<{ status: WithdrawalStatus; receipt?: TransactionReceipt }>;
  tryFinalize(
    l2TxHash: Hex,
  ): Promise<
    | { ok: true; value: { status: WithdrawalStatus; receipt?: TransactionReceipt } }
    | { ok: false; error: unknown }
  >;
}

export function WithdrawalsResource(client: ViemClient): WithdrawalsResource {
  const svc: FinalizationServices = createFinalizationServices(client);
  const { wrap, toResult } = createErrorHandlers('withdrawals');

  // ---- Build (no execution) ----
  async function buildPlan(p: WithdrawParams): Promise<WithdrawPlan<ViemPlanWriteRequest>> {
    const ctx = await commonCtx(p, client);

    await ROUTES[ctx.route].preflight?.(p, ctx);
    const { steps, approvals } = await ROUTES[ctx.route].build(p, ctx);

    const summary: WithdrawQuote = {
      route: ctx.route,
      approvalsNeeded: approvals,
      suggestedL2GasLimit: ctx.l2GasLimit,
    };
    return { route: ctx.route, summary, steps };
  }

  const finalizeCache = new Map<Hex, string>();

  // ---- Quote / Prepare ----
  const quote = (p: WithdrawParams): Promise<WithdrawQuote> =>
    wrap(OP_WITHDRAWALS.quote, async () => (await buildPlan(p)).summary, {
      message: 'Internal error while preparing a withdrawal quote.',
      ctx: { token: p.token, where: 'withdrawals.quote' },
    });

  const tryQuote = (p: WithdrawParams) =>
    toResult(OP_WITHDRAWALS.tryQuote, () => quote(p), {
      message: 'Internal error while preparing a withdrawal quote.',
      ctx: { token: p.token, where: 'withdrawals.tryQuote' },
    });

  const prepare = (p: WithdrawParams): Promise<WithdrawPlan<ViemPlanWriteRequest>> =>
    wrap(OP_WITHDRAWALS.prepare, () => buildPlan(p), {
      message: 'Internal error while preparing a withdrawal plan.',
      ctx: { token: p.token, where: 'withdrawals.prepare' },
    });

  const tryPrepare = (p: WithdrawParams) =>
    toResult(OP_WITHDRAWALS.tryPrepare, () => prepare(p), {
      message: 'Internal error while preparing a withdrawal plan.',
      ctx: { token: p.token, where: 'withdrawals.tryPrepare' },
    });

  // ---- Create (execute steps on L2) ----
  const create = (p: WithdrawParams): Promise<WithdrawHandle<ViemPlanWriteRequest>> =>
    wrap(
      OP_WITHDRAWALS.create,
      async () => {
        const plan = await prepare(p);
        const stepHashes: Record<string, Hex> = {};

        const l2Wallet = client.getL2Wallet();

        for (const step of plan.steps) {
          if (step.tx.gas == null) {
            try {
              const feePart =
                step.tx.maxFeePerGas != null && step.tx.maxPriorityFeePerGas != null
                  ? {
                      maxFeePerGas: step.tx.maxFeePerGas,
                      maxPriorityFeePerGas: step.tx.maxPriorityFeePerGas,
                    }
                  : {};

              const params: EstimateContractGasParameters = {
                address: step.tx.address,
                abi: step.tx.abi as Abi,
                functionName: step.tx.functionName,
                args: step.tx.args ?? [],
                account: step.tx.account ?? l2Wallet.account ?? client.account,
                ...(step.tx.value != null ? { value: step.tx.value } : {}),
                ...feePart,
              };
              const gas = await client.l2.estimateContractGas(params);
              step.tx.gas = (gas * 115n) / 100n;
            } catch {
              /* ignore */
            }
          }

          // Prefer 1559 only; never include gasPrice
          const fee1559 =
            step.tx.maxFeePerGas != null && step.tx.maxPriorityFeePerGas != null
              ? {
                  maxFeePerGas: step.tx.maxFeePerGas,
                  maxPriorityFeePerGas: step.tx.maxPriorityFeePerGas,
                }
              : {};

          // Build base (non-payable) request without `value`
          const baseReq = {
            address: step.tx.address,
            abi: step.tx.abi as Abi,
            functionName: step.tx.functionName,
            args: step.tx.args ?? [],
            account: step.tx.account ?? l2Wallet.account ?? client.account,
            gas: step.tx.gas,
            ...fee1559,
            ...(step.tx.dataSuffix ? { dataSuffix: step.tx.dataSuffix } : {}),
            ...(step.tx.chain ? { chain: step.tx.chain } : {}),
          } as Omit<WriteContractParameters, 'value'>;

          // Add `value` only if present (payable)
          const execReq: WriteContractParameters =
            step.tx.value != null
              ? ({ ...baseReq, value: step.tx.value } as WriteContractParameters)
              : (baseReq as WriteContractParameters);

          // Send via the wallet (must be connected to L2 or `chain` asserted)
          let hash: Hex | undefined;
          try {
            // TODO: investigate l1wallet usage here?
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            if (!client.l2Wallet) {
              throw createError('EXECUTION', {
                resource: 'withdrawals',
                operation: 'withdrawals.create.getL2Wallet',
                message: 'No L2 wallet available to send withdrawal transaction step.',
                context: { step: step.key, l2Wallet: l2Wallet },
              });
            }
            hash = await l2Wallet.writeContract(execReq);
            stepHashes[step.key] = hash;

            const rcpt = await client.l2.waitForTransactionReceipt({ hash });
            if (!rcpt || rcpt.status !== 'success') {
              throw createError('EXECUTION', {
                resource: 'withdrawals',
                operation: 'withdrawals.create.writeContract',
                message: 'Withdrawal transaction reverted on L2 during a step.',
                context: { step: step.key, txHash: hash, status: rcpt?.status },
              });
            }
          } catch (e) {
            throw toZKsyncError(
              'EXECUTION',
              {
                resource: 'withdrawals',
                operation: 'withdrawals.create.writeContract',
                message: 'Failed to send or confirm a withdrawal transaction step.',
                context: { step: step.key, txHash: hash, l2Wallet: l2Wallet },
              },
              e,
            );
          }
        }

        const keys = Object.keys(stepHashes);
        const l2TxHash = stepHashes[keys[keys.length - 1]];
        return { kind: 'withdrawal', l2TxHash, stepHashes, plan };
      },
      {
        message: 'Internal error while creating withdrawal transactions.',
        ctx: { token: p.token, amount: p.amount, to: p.to, where: 'withdrawals.create' },
      },
    );

  const tryCreate = (p: WithdrawParams) =>
    toResult(OP_WITHDRAWALS.tryCreate, () => create(p), {
      message: 'Internal error while creating withdrawal transactions.',
      ctx: { token: p.token, amount: p.amount, to: p.to, where: 'withdrawals.tryCreate' },
    });

  // ---- Status ----
  const status = (h: WithdrawalWaitable | Hex): Promise<WithdrawalStatus> =>
    wrap(
      OP_WITHDRAWALS.status,
      async () => {
        const l2TxHash: Hex =
          typeof h === 'string' ? h : 'l2TxHash' in h && h.l2TxHash ? h.l2TxHash : ('0x' as Hex);

        if (!l2TxHash || l2TxHash === ('0x' as Hex)) {
          return { phase: 'UNKNOWN', l2TxHash: '0x' as Hex };
        }

        // L2 receipt
        let l2Rcpt: TransactionReceipt | null;
        try {
          l2Rcpt = await client.l2.getTransactionReceipt({ hash: l2TxHash });
        } catch (e) {
          throw toZKsyncError(
            'RPC',
            {
              resource: 'withdrawals',
              operation: 'withdrawals.status.getTransactionReceipt',
              message: 'Failed to fetch L2 transaction receipt.',
              context: { l2TxHash },
            },
            e,
          );
        }
        if (!l2Rcpt) return { phase: 'L2_PENDING', l2TxHash };

        // Derive finalize params/key — if unavailable, not ready yet
        let pack: { params: FinalizeDepositParams; nullifier: Address } | undefined;
        try {
          pack = await svc.fetchFinalizeDepositParams(l2TxHash);
        } catch {
          return { phase: 'PENDING', l2TxHash };
        }

        const key = {
          chainIdL2: pack.params.chainId,
          l2BatchNumber: pack.params.l2BatchNumber,
          l2MessageIndex: pack.params.l2MessageIndex,
        };

        try {
          const done = await svc.isWithdrawalFinalized(key);
          if (done) return { phase: 'FINALIZED', l2TxHash, key };
        } catch {
          /* ignore; proceed to readiness sim */
        }

        const readiness = await svc.simulateFinalizeReadiness(pack.params, pack.nullifier);
        if (readiness.kind === 'FINALIZED') return { phase: 'FINALIZED', l2TxHash, key };
        if (readiness.kind === 'READY') return { phase: 'READY_TO_FINALIZE', l2TxHash, key };

        return { phase: 'PENDING', l2TxHash, key };
      },
      {
        message: 'Internal error while checking withdrawal status.',
        ctx: { where: 'withdrawals.status', l2TxHash: typeof h === 'string' ? h : h.l2TxHash },
      },
    );

  // ---- Wait ----
  const wait = (
    h: WithdrawalWaitable | Hex,
    opts: { for: 'l2' | 'ready' | 'finalized'; pollMs?: number; timeoutMs?: number } = {
      for: 'l2',
      pollMs: 5500,
    },
  ): Promise<TransactionReceiptZKsyncOS | TransactionReceipt | null> =>
    wrap(
      OP_WITHDRAWALS.wait,
      async () => {
        const l2Hash: Hex =
          typeof h === 'string' ? h : 'l2TxHash' in h && h.l2TxHash ? h.l2TxHash : ('0x' as Hex);
        if (!l2Hash || l2Hash === ('0x' as Hex)) return null;

        if (opts.for === 'l2') {
          let rcpt: TransactionReceipt | null;
          try {
            rcpt = await client.l2.waitForTransactionReceipt({ hash: l2Hash });
          } catch (e) {
            throw toZKsyncError(
              'RPC',
              {
                resource: 'withdrawals',
                operation: 'withdrawals.wait.l2.waitForTransactionReceipt',
                message: 'Failed while waiting for L2 transaction.',
                context: { l2TxHash: l2Hash },
              },
              e,
            );
          }
          if (!rcpt) return null;

          // Attach L2→L1 logs (best-effort)
          try {
            const raw = (await client.zks.getReceiptWithL2ToL1(l2Hash)) as ReceiptWithL2ToL1;
            const zkRcpt: TransactionReceiptZKsyncOS = {
              ...rcpt,
              l2ToL1Logs: raw?.l2ToL1Logs ?? [],
            };
            return zkRcpt;
          } catch {
            const zkRcpt: TransactionReceiptZKsyncOS = { ...rcpt, l2ToL1Logs: [] };
            return zkRcpt;
          }
        }

        const poll = Math.max(1000, opts.pollMs ?? 2500);
        const deadline = opts.timeoutMs ? Date.now() + opts.timeoutMs : undefined;

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const s = await status(l2Hash);

          if (opts.for === 'ready') {
            if (s.phase === 'READY_TO_FINALIZE' || s.phase === 'FINALIZED') return null;
          } else {
            if (s.phase === 'FINALIZED') {
              const l1Hash = finalizeCache.get(l2Hash) as Hex;
              if (l1Hash) {
                try {
                  const l1Rcpt = await client.l1.getTransactionReceipt({ hash: l1Hash });
                  if (l1Rcpt) {
                    finalizeCache.delete(l2Hash);
                    return l1Rcpt;
                  }
                } catch {
                  /* ignore */
                }
              }
              return null;
            }
          }

          if (deadline && Date.now() > deadline) return null;
          await new Promise((r) => setTimeout(r, poll));
        }
      },
      {
        message: 'Internal error while waiting for withdrawal.',
        ctx: {
          where: 'withdrawals.wait',
          l2TxHash: typeof h === 'string' ? h : h.l2TxHash,
          for: opts.for,
        },
      },
    );

  // ---- Finalize (L1) ----
  const finalize = (
    l2TxHash: Hex,
  ): Promise<{ status: WithdrawalStatus; receipt?: TransactionReceipt }> =>
    wrap(
      OP_WITHDRAWALS.finalize.send,
      async () => {
        const pack = await (async () => {
          try {
            return await svc.fetchFinalizeDepositParams(l2TxHash);
          } catch (e: unknown) {
            throw createError('STATE', {
              resource: 'withdrawals',
              operation: OP_WITHDRAWALS.finalize.fetchParams.receipt,
              message: 'Withdrawal not ready: finalize params unavailable.',
              context: { l2TxHash },
              cause: e,
            });
          }
        })();

        const { params, nullifier } = pack;
        const key = {
          chainIdL2: params.chainId,
          l2BatchNumber: params.l2BatchNumber,
          l2MessageIndex: params.l2MessageIndex,
        };

        try {
          const done = await svc.isWithdrawalFinalized(key);
          if (done) {
            const statusNow = await status(l2TxHash);
            return { status: statusNow };
          }
        } catch {
          /* best-effort */
        }

        const readiness = await svc.simulateFinalizeReadiness(params, nullifier);
        if (readiness.kind === 'FINALIZED') {
          const statusNow = await status(l2TxHash);
          return { status: statusNow };
        }
        if (readiness.kind === 'NOT_READY') {
          throw createError('STATE', {
            resource: 'withdrawals',
            operation: OP_WITHDRAWALS.finalize.readiness.simulate,
            message: 'Withdrawal not ready to finalize.',
            context: readiness,
          });
        }

        // READY → send finalize tx on L1
        try {
          const tx = await svc.finalizeDeposit(params, nullifier);
          finalizeCache.set(l2TxHash, tx.hash);
          const rcpt = await tx.wait();
          const statusNow = await status(l2TxHash);
          return { status: statusNow, receipt: rcpt };
        } catch (e) {
          const statusNow = await status(l2TxHash);
          if (statusNow.phase === 'FINALIZED') return { status: statusNow };

          try {
            const again = await svc.simulateFinalizeReadiness(params, nullifier);
            if (again.kind === 'NOT_READY') {
              throw createError('STATE', {
                resource: 'withdrawals',
                operation: OP_WITHDRAWALS.finalize.readiness.simulate,
                message: 'Withdrawal not ready to finalize.',
                context: again,
              });
            }
          } catch {
            /* ignore; rethrow EXECUTION error below */
          }
          throw e;
        }
      },
      {
        message: 'Internal error while attempting to finalize withdrawal.',
        ctx: { l2TxHash, where: 'withdrawals.finalize' },
      },
    );

  const tryFinalize = (l2TxHash: Hex) =>
    toResult('withdrawals.tryFinalize', () => finalize(l2TxHash), {
      message: 'Internal error while attempting to tryFinalize withdrawal.',
      ctx: { l2TxHash, where: 'withdrawals.tryFinalize' },
    });

  return {
    quote,
    tryQuote,
    prepare,
    tryPrepare,
    create,
    tryCreate,
    status,
    wait,
    finalize,
    tryFinalize,
  };
}
