/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
// src/adapters/ethers/resources/withdrawals/index.ts
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { type TransactionRequest, type TransactionReceipt, NonceManager } from 'ethers';
import type { EthersClient } from '../../client';
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
import { commonCtx } from './context';
import { toZKsyncError } from '../../errors/to-zksync-error';
import { createError } from '../../../../core/errors/factory';
import type { WithdrawRouteStrategy, TransactionReceiptZKsyncOS } from './routes/types';
import { routeEth } from './routes/eth';
import { routeErc20 } from './routes/erc20';
import { createFinalizationServices, type FinalizationServices } from './services/finalization';
import { makeErrorOps } from '../../errors/to-zksync-error';
import { OP_WITHDRAWALS } from '../../../../core/types/errors';

// bind helpers to the withdrawals resource once
const { withOp, toResult } = makeErrorOps('withdrawals');

const ROUTES: Record<WithdrawRoute, WithdrawRouteStrategy> = {
  eth: routeEth(),
  erc20: routeErc20(),
};

export interface WithdrawalsResource {
  quote(p: WithdrawParams): Promise<WithdrawQuote>;
  tryQuote(
    p: WithdrawParams,
  ): Promise<{ ok: true; value: WithdrawQuote } | { ok: false; error: unknown }>;

  prepare(p: WithdrawParams): Promise<WithdrawPlan<TransactionRequest>>;
  tryPrepare(
    p: WithdrawParams,
  ): Promise<{ ok: true; value: WithdrawPlan<TransactionRequest> } | { ok: false; error: unknown }>;

  create(p: WithdrawParams): Promise<WithdrawHandle<TransactionRequest>>;
  tryCreate(
    p: WithdrawParams,
  ): Promise<
    { ok: true; value: WithdrawHandle<TransactionRequest> } | { ok: false; error: unknown }
  >;

  // Returns finalization status
  status(h: WithdrawalWaitable | Hex): Promise<WithdrawalStatus>;

  /**
   * Waits for the L2 withdrawal tx to be included and returns a receipt
   * This does NOT attempt L1 finalization.
   */
  wait(
    h: WithdrawalWaitable | Hex,
    opts: { for: 'l2' | 'ready' | 'finalized'; pollMs?: number; timeoutMs?: number },
  ): Promise<TransactionReceiptZKsyncOS | TransactionReceipt | null>;

  /**
   * Attempts to finalize on L1 now. If proofs not yet available, throws WithdrawalNotReady.
   * If already finalized, returns { status: "finalized" } with no receipt.
   * If we just finalized, returns the new L1 receipt.
   */
  finalize(l2TxHash: Hex): Promise<{ status: WithdrawalStatus; receipt?: TransactionReceipt }>;
  tryFinalize(
    l2TxHash: Hex,
  ): Promise<
    | { ok: true; value: { status: WithdrawalStatus; receipt?: TransactionReceipt } }
    | { ok: false; error: unknown }
  >;
}

export function WithdrawalsResource(client: EthersClient): WithdrawalsResource {
  const svc: FinalizationServices = createFinalizationServices(client);
  async function buildPlan(p: WithdrawParams): Promise<WithdrawPlan<TransactionRequest>> {
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

  const quote = (p: WithdrawParams): Promise<WithdrawQuote> =>
    withOp(
      OP_WITHDRAWALS.quote,
      'Internal error while preparing a withdrawal quote.',
      { token: p.token, where: 'withdrawals.quote' },
      async () => {
        const plan = await buildPlan(p);
        return plan.summary;
      },
    );

  const tryQuote = (p: WithdrawParams) =>
    toResult(
      OP_WITHDRAWALS.tryQuote,
      { token: p.token, where: 'withdrawals.tryQuote' },
      async () => {
        const plan = await buildPlan(p);
        return plan.summary;
      },
    );

  const prepare = (p: WithdrawParams): Promise<WithdrawPlan<TransactionRequest>> =>
    withOp(
      OP_WITHDRAWALS.prepare,
      'Internal error while preparing a withdrawal plan.',
      { token: p.token, where: 'withdrawals.prepare' },
      () => buildPlan(p),
    );

  const tryPrepare = (p: WithdrawParams) =>
    toResult(OP_WITHDRAWALS.tryPrepare, { token: p.token, where: 'withdrawals.tryPrepare' }, () =>
      buildPlan(p),
    );

  const create = (p: WithdrawParams): Promise<WithdrawHandle<TransactionRequest>> =>
    withOp(
      OP_WITHDRAWALS.create,
      'Internal error while creating withdrawal transactions.',
      { token: p.token, amount: p.amount, to: p.to, where: 'withdrawals.create' },
      async () => {
        const plan = await prepare(p); // uses its own withOp(OP_WITHDRAWALS.prepare)
        const stepHashes: Record<string, Hex> = {};

        const managed = new NonceManager(client.signer);
        const from = await managed.getAddress();
        const l2Signer = managed.connect(client.l2);
        let next = await client.l2.getTransactionCount(from, 'pending');

        for (const step of plan.steps) {
          step.tx.nonce = next++;

          if (!step.tx.gasLimit) {
            try {
              const est = await client.l2.estimateGas(step.tx);
              step.tx.gasLimit = (BigInt(est) * 115n) / 100n;
            } catch {
              // ignore
            }
          }

          let hash: Hex | undefined;
          try {
            const sent = await l2Signer.sendTransaction(step.tx);
            hash = sent.hash as Hex;
            stepHashes[step.key] = hash;

            const rcpt = await sent.wait();
            if ((rcpt as any)?.status === 0) {
              throw createError('EXECUTION', {
                resource: 'withdrawals',
                operation: 'withdrawals.create.sendTransaction',
                message: 'Withdrawal transaction reverted on L2 during a step.',
                context: { step: step.key, txHash: hash, nonce: Number(step.tx.nonce ?? -1) },
              });
            }
          } catch (e) {
            // Map send/wait failures to EXECUTION; revert data decoded by toZKsyncError
            throw toZKsyncError(
              'EXECUTION',
              {
                resource: 'withdrawals',
                operation: 'withdrawals.create.sendTransaction',
                message: 'Failed to send or confirm a withdrawal transaction step.',
                context: { step: step.key, txHash: hash, nonce: Number(step.tx.nonce ?? -1) },
              },
              e,
            );
          }
        }

        const keys = Object.keys(stepHashes);
        const l2TxHash = stepHashes[keys[keys.length - 1]];
        return { kind: 'withdrawal', l2TxHash, stepHashes, plan };
      },
    );

  const tryCreate = (p: WithdrawParams) =>
    toResult(
      OP_WITHDRAWALS.tryCreate,
      { token: p.token, amount: p.amount, to: p.to, where: 'withdrawals.tryCreate' },
      () => create(p),
    );

  const status = (h: WithdrawalWaitable | Hex): Promise<WithdrawalStatus> =>
    withOp(
      OP_WITHDRAWALS.status,
      'Internal error while checking withdrawal status.',
      { input: h, where: 'withdrawals.status' },
      async () => {
        const l2TxHash: Hex =
          typeof h === 'string' ? h : 'l2TxHash' in h && h.l2TxHash ? h.l2TxHash : ('0x' as Hex);

        if (!l2TxHash || l2TxHash === ('0x' as Hex)) {
          return { phase: 'UNKNOWN', l2TxHash: '0x' as Hex };
        }

        // ---- L2 receipt ----
        let l2Rcpt;
        try {
          l2Rcpt = await client.l2.getTransactionReceipt(l2TxHash);
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

        // ---- Derive finalize params / key ----
        let pack: { params: FinalizeDepositParams; nullifier: Address } | undefined;
        try {
          pack = await svc.fetchFinalizeDepositParams(l2TxHash); // already wrapped via withRouteOp
        } catch {
          // L2 included but not yet finalizable (proofs/indices unavailable)
          return { phase: 'PENDING', l2TxHash };
        }

        const key = {
          chainIdL2: pack.params.chainId,
          l2BatchNumber: pack.params.l2BatchNumber,
          l2MessageIndex: pack.params.l2MessageIndex,
        };

        try {
          const done = await svc.isWithdrawalFinalized(key); // wrapped via withRouteOp
          if (done) return { phase: 'FINALIZED', l2TxHash, key };
        } catch {
          // ignore; continue to readiness simulation
        }

        // ---- Ask L1 if finalization would succeed right now ----
        const readiness = await svc.simulateFinalizeReadiness(pack.params, pack.nullifier); // wrapped via withRouteOp

        if (readiness.kind === 'FINALIZED') return { phase: 'FINALIZED', l2TxHash, key };
        if (readiness.kind === 'READY') return { phase: 'READY_TO_FINALIZE', l2TxHash, key };

        return { phase: 'PENDING', l2TxHash, key };
      },
    );

  const wait = (
    h: WithdrawalWaitable | Hex,
    opts: { for: 'l2' | 'ready' | 'finalized'; pollMs?: number; timeoutMs?: number } = {
      for: 'l2',
      pollMs: 2500,
    },
  ): Promise<TransactionReceiptZKsyncOS | TransactionReceipt | null> =>
    withOp(
      OP_WITHDRAWALS.wait,
      'Internal error while waiting for withdrawal.',
      {
        input: h,
        for: opts?.for,
        timeoutMs: opts?.timeoutMs,
        pollMs: opts?.pollMs,
        where: 'withdrawals.wait',
      },
      async () => {
        const l2Hash: Hex =
          typeof h === 'string' ? h : 'l2TxHash' in h && h.l2TxHash ? h.l2TxHash : ('0x' as Hex);

        if (!l2Hash || l2Hash === ('0x' as Hex)) return null;

        // wait for L2 inclusion
        if (opts.for === 'l2') {
          let rcpt;
          try {
            rcpt = await client.l2.waitForTransaction(l2Hash);
          } catch (e) {
            throw toZKsyncError(
              'RPC',
              {
                resource: 'withdrawals',
                operation: 'withdrawals.wait.l2.waitForTransaction',
                message: 'Failed while waiting for L2 transaction.',
                context: { l2TxHash: l2Hash },
              },
              e,
            );
          }
          if (!rcpt) return null;

          // Best-effort enrichment; non-fatal if it fails
          try {
            const raw = await client.zks.getReceiptWithL2ToL1(l2Hash);
            (rcpt as any).l2ToL1Logs = raw?.l2ToL1Logs ?? [];
          } catch {
            (rcpt as any).l2ToL1Logs = (rcpt as any).l2ToL1Logs ?? [];
          }
          return rcpt as unknown as TransactionReceiptZKsyncOS;
        }

        const poll = Math.max(1000, opts.pollMs ?? 2500);
        const deadline = opts.timeoutMs ? Date.now() + opts.timeoutMs : undefined;

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const s = await status(l2Hash);

          if (opts.for === 'ready') {
            // Resolve when finalization becomes possible OR already finalized.
            if (s.phase === 'READY_TO_FINALIZE' || s.phase === 'FINALIZED') return null;
          } else {
            // for: 'finalized'
            if (s.phase === 'FINALIZED') {
              const l1Hash = finalizeCache.get(l2Hash);
              if (l1Hash) {
                try {
                  const l1Rcpt = await client.l1.getTransactionReceipt(l1Hash);
                  if (l1Rcpt) {
                    finalizeCache.delete(l2Hash);
                    return l1Rcpt;
                  }
                } catch {
                  /* ignore; fall through to returning null */
                }
              }
              return null;
            }
          }

          if (deadline && Date.now() > deadline) return null;
          await new Promise((r) => setTimeout(r, poll));
        }
      },
    );

  const finalize = (
    l2TxHash: Hex,
  ): Promise<{ status: WithdrawalStatus; receipt?: TransactionReceipt }> =>
    withOp(
      'withdrawals.finalize',
      'Internal error while attempting to finalize withdrawal.',
      { l2TxHash, where: 'withdrawals.finalize' },
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
          /* best-effort; continue */
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

        // READY → send tx, wait, then re-check
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
            /* ignore; fall through to rethrow EXECUTION error */
          }
          throw e;
        }
      },
    );

  const tryFinalize = (l2TxHash: Hex) =>
    toResult('withdrawals.tryFinalize', { l2TxHash, where: 'withdrawals.tryFinalize' }, () =>
      finalize(l2TxHash),
    );

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
