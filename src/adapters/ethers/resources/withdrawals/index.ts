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
// import { WithdrawalNotReady } from '../../../../core/types/flows/withdrawals';
import type { WithdrawRouteStrategy, TransactionReceiptZKsyncOS } from './routes/types';
import { routeEth } from './routes/eth';
import { routeErc20 } from './routes/erc20';
import { createFinalizationServices, type FinalizationServices } from './services/finalization';

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
      const l2Signer = managed.connect(client.l2);
      let next = await client.l2.getTransactionCount(from, 'pending');

      for (const step of plan.steps) {
        step.tx.nonce = next++;

        if (!step.tx.gasLimit) {
          try {
            const est = await client.l2.estimateGas(step.tx);
            step.tx.gasLimit = (BigInt(est) * 115n) / 100n;
          } catch {
            // ignore;
          }
        }
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
    async status(h) {
      const l2TxHash: Hex =
        typeof h === 'string' ? h : 'l2TxHash' in h && h.l2TxHash ? h.l2TxHash : ('0x' as Hex);

      if (!l2TxHash || l2TxHash === ('0x' as Hex)) {
        return { phase: 'UNKNOWN', l2TxHash: '0x' as Hex };
      }

      // Has the L2 tx landed?
      const l2Rcpt = await client.l2.getTransactionReceipt(l2TxHash).catch(() => null);
      if (!l2Rcpt) {
        return { phase: 'L2_PENDING', l2TxHash };
      }

      // Try to derive finalize params & proof bundle from L2 receipt/logs
      let pack: { params: FinalizeDepositParams; nullifier: Address } | undefined;
      try {
        pack = await svc.fetchFinalizeDepositParams(l2TxHash);
      } catch {
        // L2 included but not ready for finalization
        return {
          phase: 'PENDING',
          l2TxHash,
        };
      }

      const key = {
        chainIdL2: pack.params.chainId,
        l2BatchNumber: pack.params.l2BatchNumber,
        l2MessageIndex: pack.params.l2MessageIndex,
      };

      // If already finalized, short-circuit
      try {
        const done = await svc.isWithdrawalFinalized(key);
        if (done) {
          return {
            phase: 'FINALIZED',
            l2TxHash,
            proof: { batchNumber: key.l2BatchNumber, messageIndex: key.l2MessageIndex },
          };
        }
      } catch {
        // ignore; we'll fall through to simulate
      }

      // Ask L1 if finalization would succeed *right now*
      const readiness = await svc.simulateFinalizeReadiness(pack.params, pack.nullifier);

      if (readiness.kind === 'FINALIZED') {
        return {
          phase: 'FINALIZED',
          l2TxHash,
          proof: { batchNumber: key.l2BatchNumber, messageIndex: key.l2MessageIndex },
        };
      }
      if (readiness.kind === 'READY') {
        return {
          phase: 'READY_TO_FINALIZE',
          l2TxHash,
          proof: { batchNumber: key.l2BatchNumber, messageIndex: key.l2MessageIndex },
        };
      }

      return {
        phase: 'PENDING',
        l2TxHash,
        proof: { batchNumber: key.l2BatchNumber, messageIndex: key.l2MessageIndex },
      };
    },

    async wait(h, opts) {
      const l2Hash: Hex =
        typeof h === 'string' ? h : 'l2TxHash' in h && h.l2TxHash ? h.l2TxHash : ('0x' as Hex);

      if (!l2Hash || l2Hash === ('0x' as Hex)) return null;

      // Case 1: wait for L2 inclusion
      if (opts.for === 'l2') {
        const rcpt = await client.l2.waitForTransaction(l2Hash);
        if (!rcpt) return null;

        try {
          const raw = await client.zks.getReceiptWithL2ToL1(l2Hash);
          (rcpt as any).l2ToL1Logs = raw?.l2ToL1Logs ?? [];
        } catch {
          (rcpt as any).l2ToL1Logs = (rcpt as any).l2ToL1Logs ?? [];
        }
        return rcpt as unknown as TransactionReceiptZKsyncOS;
      }

      // Cases 2 & 3: poll status() until condition holds
      const poll = Math.max(1000, opts.pollMs ?? 2500);
      const deadline = opts.timeoutMs ? Date.now() + opts.timeoutMs : undefined;

      while (true) {
        const s = await this.status(l2Hash);

        if (opts.for === 'ready') {
          // Resolve when finalization becomes possible OR already finalized.
          if (s.phase === 'READY_TO_FINALIZE' || s.phase === 'FINALIZED') return null;
        } else {
          // for: 'finalized'
          if (s.phase === 'FINALIZED') {
            // If we were the sender, return the L1 receipt; otherwise null is fine.
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

    async finalize(l2TxHash) {
      // Build finalize params
      const pack = await (async () => {
        try {
          return await svc.fetchFinalizeDepositParams(l2TxHash);
        } catch (e: any) {
          const err = new Error('WithdrawalNotReady');
          (err as any).meta = {
            kind: 'NOT_READY',
            reason: 'params-unavailable',
            detail: e?.message,
          };
          throw err;
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
          const status = await this.status(l2TxHash);
          return { status }; // no receipt
        }
      } catch {
        /* ignore; we’ll still simulate below */
      }

      // Readiness: static-call finalizeDeposit on L1
      const readiness = await svc.simulateFinalizeReadiness(params, nullifier);
      if (readiness.kind === 'FINALIZED') {
        const status = await this.status(l2TxHash);
        return { status };
      }
      if (readiness.kind === 'NOT_READY') {
        const err = new Error('WithdrawalNotReady');
        (err as any).meta = readiness;
        throw err;
      }

      // READY → send tx, wait, re-check status
      try {
        const tx = await svc.finalizeDeposit(params, nullifier);
        finalizeCache.set(l2TxHash, tx.hash);
        const rcpt = await tx.wait();

        const status = await this.status(l2TxHash);
        return { status, receipt: rcpt };
      } catch (e) {
        // finalized after we simulated but before our tx landed
        const status = await this.status(l2TxHash);
        if (status.phase === 'FINALIZED') return { status };

        // If not finalized, reclassify as "not ready" if simulation now says so
        try {
          const again = await svc.simulateFinalizeReadiness(params, nullifier);
          if (again.kind === 'NOT_READY') {
            const err = new Error('WithdrawalNotReady');
            (err as any).meta = again;
            throw err;
          }
        } catch {
          /* ignore; fall through */
        }
        throw e;
      }
    },

    async tryFinalize(l2TxHash) {
      try {
        const value = await this.finalize(l2TxHash);
        return { ok: true, value };
      } catch (error) {
        return { ok: false, error };
      }
    },
  };
}
