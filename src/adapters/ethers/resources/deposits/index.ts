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
} from '../../../../types/flows/deposits.ts';
import type { Address, Hex } from '../../../../types/primitives.ts';
import {
  tryExtractL2TxHashFromLogs,
} from './l2-wait';

import { Contract, type TransactionRequest, type TransactionReceipt } from 'ethers';
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

  wait(
    h: DepositWaitable,
    opts: { for: 'l1' | 'l2' | 'finalized' },
  ): Promise<TransactionReceipt | null>;
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

      const from = await client.signer.getAddress();
      let next = await client.l1.getTransactionCount(from, 'pending');

      for (const step of plan.steps) {
        // re-check allowance so we only send real steps
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
        console.log('Sending transaction:', step.tx);
        const sent = await client.signer.sendTransaction(step.tx);
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

    // TODO: still need clean up this flow for L1/L2
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    // inside DepositsResource(client)
    async wait(h, opts) {
      const l1Hash = typeof h === 'string' ? h : 'l1TxHash' in h ? h.l1TxHash : undefined;
      if (!l1Hash) return null;

      // 1) Wait for L1 inclusion
      const l1Rcpt = await client.l1.waitForTransaction(l1Hash);
      if (!l1Rcpt) return null;
      if (opts.for === 'l1') return l1Rcpt;

      // 2) Extract **canonical** L2 tx hash (new, robust helper)
      const info = tryExtractL2TxHashFromLogs(l1Rcpt.logs);
      if (!info?.l2Hash) {
        throw new Error('Could not find canonical L2 tx hash in L1 receipt logs.');
      }
      const l2Hash = info.l2Hash;

      // 3) Wait for the L2 priority tx to execute
      const l2Rcpt = await client.l2.waitForTransaction(l2Hash);
      if (!l2Rcpt) return null;
      if ((l2Rcpt as any).status !== 1) {
        throw new Error(`L2 deposit execution failed (tx: ${l2Hash})`);
      }
      // Return the full L2 receipt for "l2" or "finalized" requests (matches declared return type).
      if (opts.for === 'l2' || opts.for === 'finalized') return l2Rcpt;
      return null;
    },
  };
}
