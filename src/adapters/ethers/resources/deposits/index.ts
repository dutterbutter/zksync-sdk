// src/adapters/ethers/resources/deposits.ts
import type { EthersClient } from '../../client.ts';
import type {
  DepositParams,
  DepositQuote,
  DepositHandle,
  DepositWaitable,
  DepositPlan,
  DepositRoute,
  DepositStatus,
} from '../../../../core/types/flows/deposits.ts';
import type { Address, Hex } from '../../../../core/types/primitives.ts';
import { extractL2TxHashFromL1Logs, waitForL2ExecutionFromL1Tx } from './services/verification.ts';

import { Contract, type TransactionRequest, type TransactionReceipt, NonceManager } from 'ethers';
import IERC20ABI from '../../../../internal/abis/IERC20.json' assert { type: 'json' };

import { commonCtx } from './context';
import { routeEthDirect } from './routes/eth';
import { routeErc20NonBase } from './routes/erc20-nonbase';
import type { DepositRouteStrategy } from './routes/types.ts';

import { isZKsyncError, OP_DEPOSITS } from '../../../../core/types/errors';
import { createError } from '../../../../core/errors/factory.ts';
import { toZKsyncError, createErrorHandlers } from '../../errors/error-ops.ts';

const { wrap, toResult } = createErrorHandlers('deposits');

// --------------------
// Deposit Route map
// --------------------
// DepositRoute = 'eth' | 'erc20-nonbase';
const ROUTES: Record<DepositRoute, DepositRouteStrategy> = {
  eth: routeEthDirect(),
  'erc20-nonbase': routeErc20NonBase(),
};

// --------------------
// Public interface
// --------------------
export interface DepositsResource {
  // Get a quote for a deposit operation
  // TODO: should we have a separate quote() method that doesn't require a wallet
  // TODO: needs better gas response
  quote(p: DepositParams): Promise<DepositQuote>;

  // Try to get a quote for a deposit operation
  tryQuote(
    p: DepositParams,
  ): Promise<{ ok: true; value: DepositQuote } | { ok: false; error: unknown }>;

  // Prepare a deposit plan (route + steps) without executing it
  prepare(p: DepositParams): Promise<DepositPlan<TransactionRequest>>;

  // Try to prepare a deposit plan without executing it
  tryPrepare(
    p: DepositParams,
  ): Promise<{ ok: true; value: DepositPlan<TransactionRequest> } | { ok: false; error: unknown }>;

  // Execute a deposit operation
  // Returns a handle that can be used to track the status of the deposit
  create(p: DepositParams): Promise<DepositHandle<TransactionRequest>>;

  // Try to execute a deposit operation
  tryCreate(
    p: DepositParams,
  ): Promise<
    { ok: true; value: DepositHandle<TransactionRequest> } | { ok: false; error: unknown }
  >;

  // Check the status of a deposit operation
  // Can be given either a DepositWaitable (from create) or an L1 tx hash
  status(h: DepositWaitable | Hex): Promise<DepositStatus>;

  // Wait for a deposit to be completed
  // If 'for' is 'l1', waits for L1 inclusion only
  // If 'for' is 'l2', waits for L1 inclusion and L2 execution
  // Returns the relevant receipt, or null if the input handle has no L1 tx hash
  wait(h: DepositWaitable, opts: { for: 'l1' | 'l2' }): Promise<TransactionReceipt | null>;

  // Try to wait for a deposit to be completed
  tryWait(
    h: DepositWaitable,
    opts: { for: 'l1' | 'l2' },
  ): Promise<{ ok: true; value: TransactionReceipt } | { ok: false; error: unknown }>;
}

// --------------------
// Resource factory
// --------------------
export function DepositsResource(client: EthersClient): DepositsResource {
  // buildPlan constructs a DepositPlan for the given params
  // It does not execute any transactions
  // It can run preflight checks and may throw if the deposit cannot be performed
  async function buildPlan(p: DepositParams): Promise<DepositPlan<TransactionRequest>> {
    const ctx = await commonCtx(p, client);

    const route = ctx.route;
    await ROUTES[route].preflight?.(p, ctx);

    const { steps, approvals, quoteExtras } = await ROUTES[route].build(p, ctx);
    const { baseCost, mintValue } = quoteExtras;

    return {
      route: ctx.route,
      summary: {
        route: ctx.route,
        approvalsNeeded: approvals,
        baseCost,
        mintValue,
        suggestedL2GasLimit: ctx.l2GasLimit,
        gasPerPubdata: ctx.gasPerPubdata,
      },
      steps,
    };
  }

  // quote builds a deposit and returns its summary without executing it
  const quote = async (p: DepositParams): Promise<DepositQuote> =>
    wrap(
      OP_DEPOSITS.quote,
      async () => {
        const plan = await buildPlan(p);
        return plan.summary;
      },
      {
        message: 'Internal error while preparing a deposit quote.',
        ctx: { token: p.token, where: 'deposits.quote' },
      },
    );

  // tryQuote is like quote, but returns a TryResult instead of throwing
  const tryQuote = (p: DepositParams) =>
    toResult<DepositQuote>(OP_DEPOSITS.tryQuote, () => quote(p), {
      message: 'Internal error while preparing a deposit quote.',
      ctx: { token: p.token, where: 'deposits.tryQuote' },
    });

  // prepare prepares a deposit plan without executing it
  const prepare = (p: DepositParams): Promise<DepositPlan<TransactionRequest>> =>
    wrap(OP_DEPOSITS.prepare, () => buildPlan(p), {
      message: 'Internal error while preparing a deposit plan.',
      ctx: { token: p.token, where: 'deposits.prepare' },
    });

  // tryPrepare is like prepare, but returns a TryResult instead of throwing
  const tryPrepare = (p: DepositParams) =>
    toResult<DepositPlan<TransactionRequest>>(OP_DEPOSITS.tryPrepare, () => prepare(p), {
      ctx: { token: p.token, where: 'deposits.tryPrepare' },
    });

  // create prepares and executes a deposit plan
  // It returns a handle that can be used to track the status of the deposit
  const create = (p: DepositParams): Promise<DepositHandle<TransactionRequest>> =>
    wrap(
      OP_DEPOSITS.create,
      async () => {
        const plan = await prepare(p);
        const stepHashes: Record<string, Hex> = {};

        const managed = new NonceManager(client.signer);

        const from = await managed.getAddress();
        let next = await client.l1.getTransactionCount(from, 'latest');

        for (const step of plan.steps) {
          // re-check allowance
          if (step.kind === 'approve') {
            try {
              const [, token, router] = step.key.split(':');
              const erc20 = new Contract(token as Address, IERC20ABI, client.signer);
              const target = plan.summary.approvalsNeeded[0]?.amount ?? 0n;

              const current = (await erc20.allowance(from, router as Address)) as bigint;
              if (current >= target) {
                // Skip redundant approve
                continue;
              }
            } catch (e) {
              throw toZKsyncError(
                'CONTRACT',
                {
                  resource: 'deposits',
                  operation: 'deposits.create.erc20-allowance-recheck',
                  context: { where: 'erc20.allowance(recheck)', step: step.key, from },
                  message: 'Failed to read ERC-20 allowance during deposit step.',
                },
                e,
              );
            }
          }
          step.tx.nonce = next++;

          // TODO: fix gas estimation
          if (!step.tx.gasLimit) {
            try {
              const est = await client.l1.estimateGas(step.tx);
              step.tx.gasLimit = (BigInt(est) * 115n) / 100n;
            } catch {
              // ignore
            }
          }

          let hash: Hex | undefined;
          try {
            const sent = await managed.sendTransaction(step.tx);
            hash = sent.hash as Hex;
            stepHashes[step.key] = hash;

            const rcpt = await sent.wait();
            if (rcpt?.status === 0) {
              throw createError('EXECUTION', {
                resource: 'deposits',
                operation: 'deposits.create.sendTransaction',
                message: 'Deposit transaction reverted on L1 during a step.',
                context: { step: step.key, txHash: hash },
              });
            }
          } catch (e) {
            if (isZKsyncError(e)) throw e;
            throw toZKsyncError(
              'EXECUTION',
              {
                resource: 'deposits',
                operation: 'deposits.create.sendTransaction',
                context: { step: step.key, txHash: hash, nonce: Number(step.tx.nonce ?? -1) },
                message: 'Failed to send or confirm a deposit transaction step.',
              },
              e,
            );
          }
        }
        const ordered = Object.entries(stepHashes);
        const last = ordered[ordered.length - 1][1];
        return { kind: 'deposit', l1TxHash: last, stepHashes, plan };
      },
      {
        message: 'Internal error while creating a deposit.',
        ctx: { token: p.token, amount: p.amount, to: p.to, where: 'deposits.create' },
      },
    );

  // tryCreate is like create, but returns a TryResult instead of throwing
  const tryCreate = (p: DepositParams) =>
    toResult<DepositHandle<TransactionRequest>>(OP_DEPOSITS.tryCreate, () => create(p), {
      message: 'Internal error while creating a deposit.',
      ctx: { token: p.token, amount: p.amount, to: p.to, where: 'deposits.tryCreate' },
    });

  // status checks the status of a deposit given its handle or L1 tx hash
  // It queries both L1 and L2 to determine the current phase
  const status = (h: DepositWaitable | Hex): Promise<DepositStatus> =>
    wrap(
      OP_DEPOSITS.status,
      async () => {
        const l1TxHash: Hex = typeof h === 'string' ? h : h.l1TxHash;
        if (!l1TxHash) {
          return { phase: 'UNKNOWN', l1TxHash: '0x' as Hex };
        }

        // L1 receipt
        let l1Rcpt;
        try {
          l1Rcpt = await client.l1.getTransactionReceipt(l1TxHash);
        } catch (e) {
          throw toZKsyncError(
            'RPC',
            {
              resource: 'deposits',
              operation: 'deposits.status.getTransactionReceipt',
              context: { where: 'l1.getTransactionReceipt', l1TxHash },
              message: 'Failed to fetch L1 transaction receipt.',
            },
            e,
          );
        }
        if (!l1Rcpt) return { phase: 'L1_PENDING', l1TxHash };

        let l2TxHash: Hex | undefined;
        try {
          l2TxHash = extractL2TxHashFromL1Logs(l1Rcpt.logs) ?? undefined;
        } catch (e) {
          throw toZKsyncError(
            'INTERNAL',
            {
              resource: 'deposits',
              operation: 'deposits.status.extractL2TxHashFromL1Logs',
              context: { where: 'extractL2TxHashFromL1Logs', l1TxHash },
              message: 'Failed to derive L2 transaction hash from L1 logs.',
            },
            e,
          );
        }
        if (!l2TxHash) return { phase: 'L1_INCLUDED', l1TxHash };

        // L2 receipt
        let l2Rcpt;
        try {
          l2Rcpt = await client.l2.getTransactionReceipt(l2TxHash);
        } catch (e) {
          throw toZKsyncError(
            'RPC',
            {
              resource: 'deposits',
              operation: 'deposits.status.getTransactionReceipt',
              context: { where: 'l2.getTransactionReceipt', l1TxHash, l2TxHash },
              message: 'Failed to fetch L2 transaction receipt.',
            },
            e,
          );
        }
        if (!l2Rcpt) return { phase: 'L2_PENDING', l1TxHash, l2TxHash };

        const ok = l2Rcpt.status === 1;
        return ok
          ? { phase: 'L2_EXECUTED', l1TxHash, l2TxHash }
          : { phase: 'L2_FAILED', l1TxHash, l2TxHash };
      },
      {
        message: 'Internal error while checking deposit status.',
        ctx: { input: h, where: 'deposits.status' },
      },
    );

  // wait waits for a deposit to be completed
  // If 'for' is 'l1', waits for L1 inclusion only
  // If 'for' is 'l2', waits for L1 inclusion and L2 execution
  // Returns the relevant receipt, or null if the input handle has no L1 tx hash
  const wait = (
    h: DepositWaitable | Hex,
    opts: { for: 'l1' | 'l2' },
  ): Promise<TransactionReceipt | null> =>
    wrap(
      OP_DEPOSITS.wait,
      async () => {
        const l1Hash: Hex | undefined =
          typeof h === 'string' ? h : 'l1TxHash' in h ? h.l1TxHash : undefined;

        if (!l1Hash) return null;

        // Wait for L1 inclusion
        let l1Receipt: TransactionReceipt | null;
        try {
          l1Receipt = await client.l1.waitForTransaction(l1Hash);
        } catch (e) {
          throw toZKsyncError(
            'RPC',
            {
              resource: 'deposits',
              operation: 'deposits.waitForTransaction',
              context: { where: 'l1.waitForTransaction', l1TxHash: l1Hash, for: opts.for },
              message: 'Failed while waiting for L1 transaction.',
            },
            e,
          );
        }

        if (!l1Receipt) return null;
        if (opts.for === 'l1') return l1Receipt;

        // Derive canonical L2 hash + wait for L2 execution
        try {
          const { l2Receipt } = await waitForL2ExecutionFromL1Tx(client.l1, client.l2, l1Hash);
          return l2Receipt ?? null;
        } catch (e) {
          if (isZKsyncError(e)) throw e;
          throw toZKsyncError(
            'INTERNAL',
            {
              resource: 'deposits',
              operation: 'deposits.waitForL2ExecutionFromL1Tx',
              context: { where: 'waitForL2ExecutionFromL1Tx', l1TxHash: l1Hash },
              message: 'Internal error while waiting for L2 execution.',
            },
            e,
          );
        }
      },
      {
        message: 'Internal error while waiting for deposit.',
        ctx: { input: h, for: opts?.for, where: 'deposits.wait' },
      },
    );

  // tryWait is like wait, but returns a TryResult instead of throwing
  const tryWait = (h: DepositWaitable | Hex, opts: { for: 'l1' | 'l2' }) =>
    toResult<TransactionReceipt>(
      OP_DEPOSITS.tryWait,
      async () => {
        const v = await wait(h, opts);
        if (v) return v;
        throw createError('STATE', {
          resource: 'deposits',
          operation: 'deposits.tryWait',
          message:
            opts.for === 'l2'
              ? 'No L2 receipt yet; the deposit has not executed on L2.'
              : 'No L1 receipt yet; the deposit has not been included on L1.',
          context: {
            for: opts.for,
            l1TxHash:
              typeof h === 'string'
                ? h
                : 'l1TxHash' in h
                  ? (h.l1TxHash as Hex | undefined)
                  : undefined,
            where: 'deposits.tryWait',
          },
        });
      },
      {
        message: 'Internal error while waiting for deposit.',
        ctx: { input: h, for: opts?.for, where: 'deposits.tryWait' },
      },
    );
  return { quote, tryQuote, prepare, tryPrepare, create, tryCreate, status, wait, tryWait };
}
