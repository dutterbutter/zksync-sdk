/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
// src/adapters/ethers/resources/withdrawals/index.ts
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { type TransactionRequest, type TransactionReceipt } from 'ethers';
import type { EthersClient } from '../../client';
import type {
  WithdrawParams,
  WithdrawQuote,
  WithdrawPlan,
  WithdrawHandle,
  WithdrawalWaitable,
  WithdrawRoute, FinalizedTriState
} from '../../../../types/flows/withdrawals';
import type { Hex } from '../../../../types/primitives';
import { commonCtx } from './context';
import { WithdrawalNotReady } from '../../../../types/flows/withdrawals';
import type { WithdrawRouteStrategy, TransactionReceiptZKsyncOS } from './routes/types';
import { routeEth } from './routes/eth';
import { routeErc20 } from './routes/erc20';
import {
  createFinalizationServices,
  type FinalizationServices,
} from './services/finalization';

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

   /**
   * Waits for the L2 withdrawal tx to be mined and returns an enriched receipt
   * (with l2ToL1Logs when supported). This does NOT attempt L1 finalization.
   */
  wait(h: WithdrawalWaitable, opts: { for: 'l2' }): Promise<TransactionReceiptZKsyncOS | null>;

  /**
   * Lightweight tri-state:
   *  - "unknown": cannot derive finalize params (proof not ready or data unavailable)
   *  - "pending": params derivable but not finalized yet
   *  - "finalized": already finalized on L1
   */
  isFinalized(l2TxHash: Hex): Promise<FinalizedTriState>;

  /**
   * Attempts to finalize on L1 now. If proofs not yet available, throws WithdrawalNotReady.
   * If already finalized, returns { status: "finalized" } with no receipt.
   * If we just finalized, returns the new L1 receipt.
   */
  finalize(l2TxHash: Hex): Promise<{ status: 'finalized'; receipt?: TransactionReceipt }>;
}

export function WithdrawalsResource(client: EthersClient): WithdrawalsResource {
    const svc: FinalizationServices = createFinalizationServices(client);
  async function buildPlan(p: WithdrawParams): Promise<WithdrawPlan<TransactionRequest>> {
    const ctx = await commonCtx(p, client);
     svc.primeKnownAddresses({
      l1AssetRouter: ctx.l1AssetRouter,
      nullifier:     ctx.l1Nullifier,
    });

    const route = ctx.route;

    await ROUTES[route].preflight?.(p, ctx);

    const { steps, approvals /*, quoteExtras*/ } = await ROUTES[route].build(p, ctx);

    const summary: WithdrawQuote = {
      route,
      approvalsNeeded: approvals,
      suggestedL2GasLimit: ctx.l2GasLimit,
      minGasLimitApplied: true,
      gasBufferPctApplied: ctx.gasBufferPct,
    };

    return { route, summary, steps };
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

      // Send ALL withdrawal steps on L2
      const from = (await client.signer.getAddress()) as `0x${string}`;
      const l2Signer = client.signer.connect(client.l2);
      let next = await client.l2.getTransactionCount(from, 'pending');

      for (const step of plan.steps) {
        step.tx.nonce = next++;

        if (!step.tx.gasLimit) {
          try {
            console.log('tx', step.tx);
            const est = await client.l2.estimateGas(step.tx);
            step.tx.gasLimit = (BigInt(est) * 115n) / 100n;
          } catch {
            // ignore; user/provider will fill
          }
        }
        console.log('tx for send', step.tx);
        const sent = await l2Signer.sendTransaction(step.tx);
        stepHashes[step.key] = sent.hash as Hex;
        await sent.wait();
      }

      const keys = Object.keys(stepHashes);
      const l2TxHash = stepHashes[keys[keys.length - 1]];
      return {
        kind: 'withdrawal',
        l2TxHash,
        stepHashes,
        plan,
      };
    },

    async tryCreate(p) {
      try {
        return { ok: true, value: await this.create(p) };
      } catch (err) {
        return { ok: false, error: err };
      }
    },

     async wait(h, opts) {
      if (opts.for !== 'l2') return null;

      const l2Hash =
        typeof h === 'string' ? h : ('l2TxHash' in h && h.l2TxHash ? h.l2TxHash : undefined);
      if (!l2Hash) return null;

      const base = await svc.l2WaitForTransaction(l2Hash);
      return await svc.enrichL2Receipt(l2Hash, base);
    },

    // === NEW: tri-state without encouraging tight polling ===
    async isFinalized(l2TxHash) {
      try {
        const { params, l1AssetRouter } = await svc.fetchFinalizeDepositParams(l2TxHash);
        const done = await svc.isWithdrawalFinalized(l1AssetRouter, {
          chainIdL2: params.chainId,
          l2BatchNumber: params.l2BatchNumber,
          l2MessageIndex: params.l2MessageIndex,
        });
        return done ? 'finalized' : 'pending';
      } catch {
        // Cannot derive params (likely proofs not ready)
        return 'unknown';
      }
    },

    // === NEW: attempt to finalize now; throws WithdrawalNotReady if not yet possible ===
    async finalize(l2TxHash) {
      const pack = await (async () => {
        try {
          return await svc.fetchFinalizeDepositParams(l2TxHash);
        } catch {
          throw new WithdrawalNotReady();
        }
      })();

      const { params, l1AssetRouter, nullifier } = pack;

      const done = await svc.isWithdrawalFinalized(l1AssetRouter, {
        chainIdL2: params.chainId,
        l2BatchNumber: params.l2BatchNumber,
        l2MessageIndex: params.l2MessageIndex,
      });

      if (done) return { status: 'finalized' as const };

      if (!svc.finalizeDeposit) {
        throw new Error('Finalize requires an L1 signer bound to the client.');
      }

      const tx = await svc.finalizeDeposit(params, nullifier);
      const rcpt = await tx.wait();
      return { status: 'finalized' as const, receipt: rcpt };
    },
  };
}
