// src/adapters/ethers/resources/interop/index.ts
import type { TransactionRequest } from 'ethers';
import { NonceManager } from 'ethers';

import type { EthersClient } from '../../client';
import type { Hex } from '../../../../core/types/primitives';

import type {
  InteropParams,
  InteropQuote,
  InteropHandle,
  InteropWaitable,
  InteropPlan,
  InteropRoute,
  InteropStatus,
} from '../../../../core/types/flows/interop';

import { makeInteropContext } from './context'; // tiny wrapper that returns { ...ctx, route }
import type { InteropRouteStrategy } from './routes/types';
import { routeDirect } from './routes/direct';
import { routeRouter } from './routes/router';

import { isZKsyncError, OP_INTEROP } from '../../../../core/types/errors';
import { createError } from '../../../../core/errors/factory.ts';
import { createErrorHandlers } from '../../errors/error-ops.ts';

import * as statusSvc from './services/monitor.ts';
import { pickInteropRoute } from '../../../../core/resources/interop/route.ts';

const { wrap, toResult } = createErrorHandlers('interop');

// --------------------
// Route map
// --------------------
export const ROUTES: Record<InteropRoute, InteropRouteStrategy> = {
  direct: routeDirect(),
  router: routeRouter(),
};

// --------------------
// Public interface
// --------------------
export interface InteropResource {
  quote(p: InteropParams): Promise<InteropQuote>;
  tryQuote(
    p: InteropParams,
  ): Promise<{ ok: true; value: InteropQuote } | { ok: false; error: unknown }>;

  prepare(p: InteropParams): Promise<InteropPlan<TransactionRequest>>;
  tryPrepare(
    p: InteropParams,
  ): Promise<{ ok: true; value: InteropPlan<TransactionRequest> } | { ok: false; error: unknown }>;

  create(p: InteropParams): Promise<InteropHandle<TransactionRequest>>;
  tryCreate(
    p: InteropParams,
  ): Promise<
    { ok: true; value: InteropHandle<TransactionRequest> } | { ok: false; error: unknown }
  >;

  status(h: InteropWaitable | Hex): Promise<InteropStatus>;
  wait(
    h: InteropWaitable | Hex,
    opts: { for: 'verified' | 'executed'; pollMs?: number; timeoutMs?: number },
  ): Promise<null>;
  tryWait(
    h: InteropWaitable | Hex,
    opts: { for: 'verified' | 'executed'; pollMs?: number; timeoutMs?: number },
  ): Promise<{ ok: true; value: null } | { ok: false; error: unknown }>;
}

// --------------------
// Resource factory
// --------------------
export function createInteropResource(client: EthersClient): InteropResource {
  // buildPlan constructs an InteropPlan for the given params
  // It does not execute any transactions.
  async function buildPlan(p: InteropParams): Promise<InteropPlan<TransactionRequest>> {
    // 1) Build adapter context (providers, signer, addresses, ABIs, topics, base tokens)
    const ethCtx = await wrap(
      OP_INTEROP.prepare, // “build context” phase
      () => makeInteropContext(client, p.dst),
      {
        message: 'Failed to build interop context.',
        ctx: { where: 'interop.context', dst: p.dst },
      },
    );

    // 2) Compute sender and select route (kept in index, not in context)
    const sender = (p.sender ?? (await client.signerFor().getAddress())) as Hex;

    const route = pickInteropRoute({
      actions: p.actions,
      ctx: {
        sender,
        srcChainId: ethCtx.srcChainId,
        dstChainId: ethCtx.dstChainId,
        baseTokenSrc: ethCtx.baseTokens.src,
        baseTokenDst: ethCtx.baseTokens.dst,
      },
    });

    const ctx = { ...ethCtx, route } as const;

    // 3) Optional route preflight
    await wrap(
      route === 'direct' ? OP_INTEROP.routes.direct.preflight : OP_INTEROP.routes.router.preflight,
      () => ROUTES[route].preflight?.(p, ctx),
      {
        message: 'Interop preflight failed.',
        ctx: { where: `routes.${route}.preflight`, dst: p.dst },
      },
    );

    // 4) Build route steps + approvals + quote extras
    const { steps, approvals, quoteExtras } = await wrap(
      route === 'direct' ? OP_INTEROP.routes.direct.build : OP_INTEROP.routes.router.build,
      () => ROUTES[route].build(p, ctx),
      {
        message: 'Failed to build interop route plan.',
        ctx: { where: `routes.${route}.build`, dst: p.dst },
      },
    );

    // 5) Assemble the plan summary
    const summary: InteropQuote = {
      route,
      approvalsNeeded: approvals,
      totalActionValue: quoteExtras.totalActionValue,
      bridgedTokenTotal: quoteExtras.bridgedTokenTotal,
      l1Fee: quoteExtras.l1Fee,
      l2Fee: quoteExtras.l2Fee,
    };

    return { route, summary, steps };
  }

  // quote → build and return the summary
  const quote = (p: InteropParams): Promise<InteropQuote> =>
    wrap(OP_INTEROP.quote, async () => {
      const plan = await buildPlan(p);
      return plan.summary;
    });

  const tryQuote = (p: InteropParams) => toResult<InteropQuote>('interop.tryQuote', () => quote(p));

  // prepare → build plan without executing
  const prepare = (p: InteropParams): Promise<InteropPlan<TransactionRequest>> =>
    wrap(OP_INTEROP.prepare, () => buildPlan(p), {
      message: 'Internal error while preparing an interop plan.',
      ctx: { where: 'interop.prepare', dst: p.dst },
    });

  const tryPrepare = (p: InteropParams) =>
    toResult<InteropPlan<TransactionRequest>>('interop.tryPrepare', () => prepare(p));

  // create → execute the plan
  const create = (p: InteropParams): Promise<InteropHandle<TransactionRequest>> =>
    wrap(
      OP_INTEROP.create,
      async () => {
        const plan = await prepare(p);
        const stepHashes: Record<string, Hex> = {};

        // single-source L2 send(s)
        const managed = new NonceManager(client.signerFor()); // source L2 signer
        const from = await managed.getAddress();
        let next = await client.l2.getTransactionCount(from, 'latest');

        for (const step of plan.steps) {
          step.tx.nonce = step.tx.nonce ?? next++;

          // best-effort gas limit
          if (!step.tx.gasLimit) {
            try {
              const est = await client.l2.estimateGas(step.tx);
              step.tx.gasLimit = (BigInt(est) * 115n) / 100n;
            } catch {
              // ignore: provider will backfill
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
                resource: 'interop',
                operation: 'interop.create.sendTransaction',
                message: 'Interop transaction reverted on source L2.',
                context: { step: step.key, txHash: hash },
              });
            }
          } catch (e) {
            if (isZKsyncError(e)) throw e;
            throw createError('EXECUTION', {
              resource: 'interop',
              operation: 'interop.create.sendTransaction',
              message: 'Failed to send or confirm an interop transaction step.',
              context: { step: step.key, txHash: hash, nonce: Number(step.tx.nonce ?? -1) },
              cause: e as Error,
            });
          }
        }

        // Interop: single on-chain step → last hash is the source L2 tx
        const last = Object.values(stepHashes).pop();
        return {
          kind: 'interop',
          stepHashes,
          plan,
          l2SrcTxHash: last ?? ('0x' as Hex),
          dstChainId: p.dst,
        };
      },
      {
        message: 'Internal error while creating interop bundle.',
        ctx: { where: 'interop.create', dst: p.dst },
      },
    );

  const tryCreate = (p: InteropParams) =>
    toResult<InteropHandle<TransactionRequest>>('interop.tryCreate', () => create(p));

  // status
  const status = (h: InteropWaitable | Hex): Promise<InteropStatus> =>
    wrap(OP_INTEROP.status, () => statusSvc.status(client, h), {
      message: 'Internal error while checking interop status.',
      ctx: { where: 'interop.status' },
    });

  // wait
  const wait = (
    h: InteropWaitable | Hex,
    opts: { for: 'verified' | 'executed'; pollMs?: number; timeoutMs?: number },
  ): Promise<null> =>
    wrap(OP_INTEROP.wait, () => statusSvc.wait(client, h, opts), {
      message: 'Internal error while waiting for interop execution.',
      ctx: { where: 'interop.wait', for: opts.for },
    });

  const tryWait = (
    h: InteropWaitable | Hex,
    opts: { for: 'verified' | 'executed'; pollMs?: number; timeoutMs?: number },
  ) => toResult<null>('interop.tryWait', () => wait(h, opts));

  return { quote, tryQuote, prepare, tryPrepare, create, tryCreate, status, wait, tryWait };
}
