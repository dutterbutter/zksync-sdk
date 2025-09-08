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
} from '../../../../core/types/flows/deposits.ts';
import type { Address, Hex } from '../../../../core/types/primitives.ts';
import { waitForL2ExecutionFromL1Tx } from './services/verification.ts';

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
    opts: { for: 'l1' | 'l2' },
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
      const l1Hash =
        typeof h === 'string' ? h : 'l1TxHash' in h ? h.l1TxHash : undefined;
      if (!l1Hash) return null;

      // 1) Wait for L1 inclusion (and optionally return it)
      const l1Receipt = await client.l1.waitForTransaction(l1Hash);
      if (!l1Receipt) return null;
      if (opts.for === 'l1') return l1Receipt;

      // 2) Derive canonical L2 hash + wait for L2 execution
      const { l2Receipt, l2TxHash } = await waitForL2ExecutionFromL1Tx(client.l1, client.l2, l1Hash);
      // Only 'l2' is supported here (no "finalized" concept for deposits)
      console.log("L2", l2TxHash);
      return l2Receipt;
    },
  };
}
