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
} from '../../../../types/deposits.ts';
import type { Address, Hex } from '../../../../types/primitives.ts';
// import {
//   tryExtractL2TxHashFromLogs,
//   extractCandidateHashesFromLogs,
//   getRawReceipt,
//   isServiceSuccess,
//   pollUntil,
//   hasL2ToL1Proof,
// } from "./l2-wait";

import { Contract, type TransactionReceipt } from 'ethers';
// import { IBridgehubAbi } from '../../internal/abis/Bridgehub.ts';
import { ERC20Abi } from '../../internal/abis/ERC20.ts';

import { commonCtx } from './context';
import { routeEthDirect } from './routes/eth';
import { routeErc20Base } from './routes/erc20-base';
import { routeErc20NonBase } from './routes/erc20-nonbase';
import type { RouteStrategy } from './routes/types.ts';

const ROUTES: Record<DepositRoute, RouteStrategy> = {
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

  prepare(p: DepositParams): Promise<DepositPlan>;
  tryPrepare(
    p: DepositParams,
  ): Promise<{ ok: true; value: DepositPlan } | { ok: false; error: unknown }>;

  create(p: DepositParams): Promise<DepositHandle>;
  tryCreate(
    p: DepositParams,
  ): Promise<{ ok: true; value: DepositHandle } | { ok: false; error: unknown }>;

  wait(
    h: DepositWaitable,
    opts: { for: 'l1' | 'l2' | 'finalized' },
  ): Promise<TransactionReceipt | null>;
}

// --------------------
// Resource factory
// --------------------
export function DepositsResource(client: EthersClient): DepositsResource {
  async function buildPlan(p: DepositParams): Promise<DepositPlan> {
    const ctx = await commonCtx(p, client);

    // allow route to refine (e.g., switch to non-base after checking base token)
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const route = ctx.route as DepositRoute;
    await ROUTES[route].preflight?.(p, ctx);

    const { steps, approvals, baseCost, mintValue } = await ROUTES[route].build(p, ctx);

    return {
      route: ctx.route,
      summary: {
        route: ctx.route,
        approvalsNeeded: approvals,
        baseCost, mintValue,
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
          const erc20 = new Contract(token as Address, ERC20Abi, client.signer);
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

    // TODO: still need wire up finalization flow
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async wait(h, opts) {
      const l1Hash = typeof h === "string" ? h : ("l1TxHash" in h ? h.l1TxHash : undefined);
      if (!l1Hash) return null;

      if (opts.for === "l1") {
        return await client.l1.waitForTransaction(l1Hash);
      }

      // const l1Rcpt = await client.l1.waitForTransaction(l1Hash);
      // if (!l1Rcpt) return null;

      // // 1) Fast path (ABI-parse)
      // let l2TxHash = tryExtractL2TxHashFromLogs(l1Rcpt.logs);

      // // 2) Fallback: scrape candidates & probe L2 which one is real
      // if (!l2TxHash) {
      //   const candidates = extractCandidateHashesFromLogs(l1Rcpt.logs);
      //   // Try each candidate; accept the first that produces a (pending or mined) L2 receipt
      //   for (const cand of candidates) {
      //     const r = await getRawReceipt(client.l2, cand).catch(() => null);
      //     if (r) { l2TxHash = cand as Hex; break; }
      //   }
      // }

      // if (!l2TxHash) {
      //   // Helpful debug: print topic0s seen
      //   const topic0s = Array.from(new Set(l1Rcpt.logs.map(l => (l.topics?.[0] ?? "").toLowerCase())));
      //   throw new Error(`Could not extract L2 tx hash from L1 receipt. topic0s: ${topic0s.join(", ")}`);
      // }

      // // 3) Poll L2 for success
      // const rawL2 = await pollUntil(async () => {
      //   const r = await getRawReceipt(client.l2, l2TxHash!);
      //   if (!r) return null;
      //   const statusOk = r.status === "0x1" || r.status === 1 || r.status === "1";
      //   const serviceOk = isServiceSuccess(r, l2TxHash!);
      //   return statusOk && serviceOk ? r : null;
      // });

      // if (!rawL2) return null;

      // if (opts.for === "l2") {
      //   return await client.l2.getTransactionReceipt(l2TxHash).catch(() => null);
      // }

      // if (opts.for === "finalized") {
      //   const proved = await hasL2ToL1Proof(client.l2, l2TxHash);
      //   if (!proved) {
      //     const again = await pollUntil(async () => (await hasL2ToL1Proof(client.l2, l2TxHash!)) ? true : null, {
      //       timeoutMs: 300_000,
      //       intervalMs: 3_000,
      //     });
      //     if (!again) return null;
      //   }
      //   return await client.l2.getTransactionReceipt(l2TxHash).catch(() => null);
      // }

      return await client.l1.waitForTransaction(l1Hash);
    }
  };
}
