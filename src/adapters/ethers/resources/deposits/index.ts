/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
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
import { routeErc20Base } from './routes/erc20-base';
import { routeErc20NonBase } from './routes/erc20-nonbase';
import type { DepositRouteStrategy } from './routes/types.ts';

const ROUTES: Record<DepositRoute, DepositRouteStrategy> = {
  eth: routeEthDirect(),
  'erc20-base': routeErc20Base(),
  'erc20-nonbase': routeErc20NonBase(),
};

// --------------------
// Public interface
// --------------------
export interface DepositsResource {
  quote(p: DepositParams): Promise<DepositQuote>;
  tryQuote(
    p: DepositParams,
  ): Promise<{ ok: true; value: DepositQuote } | { ok: false; error: unknown }>;

  prepare(p: DepositParams): Promise<DepositPlan<TransactionRequest>>;
  tryPrepare(
    p: DepositParams,
  ): Promise<{ ok: true; value: DepositPlan<TransactionRequest> } | { ok: false; error: unknown }>;

  create(p: DepositParams): Promise<DepositHandle<TransactionRequest>>;
  tryCreate(
    p: DepositParams,
  ): Promise<
    { ok: true; value: DepositHandle<TransactionRequest> } | { ok: false; error: unknown }
  >;

  status(h: DepositWaitable | Hex): Promise<DepositStatus>;

  wait(h: DepositWaitable, opts: { for: 'l1' | 'l2' }): Promise<TransactionReceipt | null>;
  tryWait(h: DepositWaitable, opts: { for: 'l1' | 'l2' }): Promise<{ ok: true; value: TransactionReceipt } | { ok: false; error: unknown }>
}

// --------------------
// Resource factory
// --------------------
export function DepositsResource(client: EthersClient): DepositsResource {
  async function buildPlan(p: DepositParams): Promise<DepositPlan<TransactionRequest>> {
    const ctx = await commonCtx(p, client);

    // allow route to refine (e.g., switch to non-base after checking base token)
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const route = ctx.route as DepositRoute;
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
        minGasLimitApplied: true,
        gasBufferPctApplied: 10,
      },
      steps,
    };
  }
  return {
    async quote(p) {
      const plan = await buildPlan(p);
      return plan.summary;
    },

    async tryQuote(p) {
      try {
        return { ok: true, value: await this.quote(p) };
      } catch (err) {
        return { ok: false, error: err };
      }
    },

    async prepare(p) {
      return await buildPlan(p);
    },

    async tryPrepare(p) {
      try {
        return { ok: true, value: await this.prepare(p) };
      } catch (err) {
        return { ok: false, error: err };
      }
    },

    async create(p) {
      const plan = await this.prepare(p);
      const stepHashes: Record<string, Hex> = {};

      const managed = new NonceManager(client.signer);

      const from = await managed.getAddress();
      let next = await client.l1.getTransactionCount(from, 'latest');

      for (const step of plan.steps) {
        // re-check allowance
        if (step.kind === 'approve') {
          const [, token, router] = step.key.split(':');
          const erc20 = new Contract(token as Address, IERC20ABI, client.signer);
          const target = plan.summary.approvalsNeeded[0]?.amount ?? 0n;
          if ((await erc20.allowance(from, router as Address)) >= target) continue;
        }
        step.tx.nonce = next++;

        if (!step.tx.gasLimit) {
          try {
            const est = await client.l1.estimateGas(step.tx);
            step.tx.gasLimit = (BigInt(est) * 115n) / 100n;
          } catch {
            // ignore
          }
        }
        const sent = await managed.sendTransaction(step.tx);
        stepHashes[step.key] = sent.hash as Hex;
        await sent.wait();
      }

      const keys = Object.keys(stepHashes);
      return { kind: 'deposit', l1TxHash: stepHashes[keys[keys.length - 1]], stepHashes, plan };
    },
    async tryCreate(p) {
      try {
        return { ok: true, value: await this.create(p) };
      } catch (err) {
        return { ok: false, error: err };
      }
    },

    async status(h: DepositWaitable | Hex): Promise<DepositStatus> {
      const l1TxHash: Hex = typeof h === 'string' ? (h) : h.l1TxHash;
      if (!l1TxHash) return { phase: 'UNKNOWN', l1TxHash: '0x' as Hex, hint: 'unknown' };

      // L1 receipt?
      const l1Rcpt = await client.l1.getTransactionReceipt(l1TxHash).catch(() => null);
      if (!l1Rcpt) return { phase: 'L1_PENDING', l1TxHash, hint: 'retry-later' };

      // Derive L2 canonical hash (from logs)
      const l2TxHash = extractL2TxHashFromL1Logs(l1Rcpt.logs);
      if (!l2TxHash) return { phase: 'L1_INCLUDED', l1TxHash, hint: 'retry-later' };

      // L2 receipt?
      const l2Rcpt = await client.l2.getTransactionReceipt(l2TxHash).catch(() => null);
      if (!l2Rcpt) return { phase: 'L2_PENDING', l1TxHash, l2TxHash, hint: 'retry-later' };

      const ok = (l2Rcpt as any).status === 1;
      return ok
        ? { phase: 'L2_EXECUTED', l1TxHash, l2TxHash, hint: 'already-executed' }
        : { phase: 'L2_FAILED', l1TxHash, l2TxHash, hint: 'check-logs' };
    },

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async wait(h, opts) {
      const l1Hash = typeof h === 'string' ? h : 'l1TxHash' in h ? h.l1TxHash : undefined;
      if (!l1Hash) return null;

      // Wait for L1 inclusion
      const l1Receipt = await client.l1.waitForTransaction(l1Hash);
      if (!l1Receipt) return null;
      if (opts.for === 'l1') return l1Receipt;

      // Derive canonical L2 hash + wait for L2 execution
      const { l2Receipt } = await waitForL2ExecutionFromL1Tx(client.l1, client.l2, l1Hash);

      return l2Receipt;
    },

    async tryWait(h, opts) {
      try {
        const v = await this.wait(h, opts);
        if (v) return { ok: true, value: v };
        throw new Error('No receipt');
      } catch (err) {
        return { ok: false, error: err };
      }
    },
  };
}
