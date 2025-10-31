// src/adapters/ethers/resources/interop/index.ts

import type { TransactionRequest } from 'ethers';

import type { EthersClient } from '../../client';
import type { Address, Hex } from '../../../../core/types/primitives';

import type {
  InteropParams,
  InteropQuote,
  InteropHandle,
  InteropWaitable,
  InteropPlan,
  InteropRoute,
  InteropStatus,
  InteropFinalizationResult,
} from '../../../../core/types/flows/interop';

import { makeInteropContext } from './context';
import type { InteropRouteStrategy } from './routes/types';
import { routeDirect } from './routes/direct';
import { routeIndirect } from './routes/indirect';

import { isZKsyncError } from '../../../../core/types/errors';
import { OP_INTEROP } from '../../../../core/types'; // ensure OP_INTEROP import path is correct
import { createError } from '../../../../core/errors/factory';
import { createErrorHandlers } from '../../errors/error-ops';

import {
  status as interopStatus,
  wait as interopWait,
  createInteropFinalizationServices,
} from './services/finalization';

import { pickInteropRoute } from '../../../../core/resources/interop/route';

const { wrap, toResult } = createErrorHandlers('interop');

// --------------------
// Route map
// direct   = same base token, no ERC-20 bridge
// indirect = routed via L2AssetRouter / Bridgehub for ERC-20 or base mismatch
// --------------------
export const ROUTES: Record<InteropRoute, InteropRouteStrategy> = {
  direct: routeDirect(),
  indirect: routeIndirect(),
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

  // Execute destination leg (prove + execute bundle on dest)
  // Blocks until destination tx is mined.
  finalize(h: InteropWaitable | Hex): Promise<InteropFinalizationResult>;
  tryFinalize(
    h: InteropWaitable | Hex,
  ): Promise<{ ok: true; value: InteropFinalizationResult } | { ok: false; error: unknown }>;

  // --- Lifecycle inspection ---

  // non-blocking status check
  status(h: InteropWaitable | Hex): Promise<InteropStatus>;

  // blocking check for a desired phase ('verified' or 'executed')
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
  // Internal helper: buildPlan constructs an InteropPlan for the given params.
  // It does not execute any transactions.
  async function buildPlan(p: InteropParams): Promise<InteropPlan<TransactionRequest>> {
    // 1) Build adapter context (providers, signer, addresses, ABIs, topics, base tokens)
    const ethCtx = await wrap(OP_INTEROP.prepare, () => makeInteropContext(client, p.dst), {
      message: 'Failed to build interop context.',
      ctx: { where: 'interop.context', dst: p.dst },
    });

    // 2) Compute sender and select route
    const sender = (p.sender ?? (await client.signerFor().getAddress())) as Address;

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

    // 3) Extend context so indirect route can embed sender into payloads
    const ctx = { ...ethCtx, route, sender } as const;

    // 4) Route-level preflight
    await wrap(
      route === 'direct'
        ? OP_INTEROP.routes.direct.preflight
        : OP_INTEROP.routes.indirect.preflight,
      () => ROUTES[route].preflight?.(p, ctx),
      {
        message: 'Interop preflight failed.',
        ctx: { where: `routes.${route}.preflight`, dst: p.dst },
      },
    );

    // 5) Build concrete steps, approvals, and quote extras
    const { steps, approvals, quoteExtras } = await wrap(
      route === 'direct' ? OP_INTEROP.routes.direct.build : OP_INTEROP.routes.indirect.build,
      () => ROUTES[route].build(p, ctx),
      {
        message: 'Failed to build interop route plan.',
        ctx: { where: `routes.${route}.build`, dst: p.dst },
      },
    );

    // 6) Assemble plan summary
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

  const tryQuote = (p: InteropParams) =>
    toResult<InteropQuote>(OP_INTEROP.tryQuote, () => quote(p));

  // prepare → build plan without executing
  const prepare = (p: InteropParams): Promise<InteropPlan<TransactionRequest>> =>
    wrap(OP_INTEROP.prepare, () => buildPlan(p), {
      message: 'Internal error while preparing an interop plan.',
      ctx: { where: 'interop.prepare', dst: p.dst },
    });

  const tryPrepare = (p: InteropParams) =>
    toResult<InteropPlan<TransactionRequest>>(OP_INTEROP.tryPrepare, () => prepare(p));

  // create → execute the source-chain step(s)
  // waits for each tx receipt to confirm (status != 0)
  const create = (p: InteropParams): Promise<InteropHandle<TransactionRequest>> =>
    wrap(
      OP_INTEROP.create,
      async () => {
        const plan = await prepare(p);
        const stepHashes: Record<string, Hex> = {};

        // NOTE:
        // For now we assume source is the client's "l2" provider/signing context.
        // If/when we add multi-L2 or L3 support, this should come from makeInteropContext().
        const signer = client.signerFor();
        const from = await signer.getAddress();
        let next = await client.l2.getTransactionCount(from, 'latest');

        for (const step of plan.steps) {
          // Ensure deterministic nonce ordering
          step.tx.nonce = step.tx.nonce ?? next++;

          // best-effort gasLimit with 15% buffer
          if (!step.tx.gasLimit) {
            try {
              const est = await client.l2.estimateGas(step.tx);
              step.tx.gasLimit = (BigInt(est) * 115n) / 100n;
            } catch {
              // fallback: signer/provider can still populate gasLimit on send
            }
          }

          let hash: Hex | undefined;
          try {
            const sent = await signer.sendTransaction(step.tx);
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
              context: {
                step: step.key,
                txHash: hash,
                nonce: Number(step.tx.nonce ?? -1),
              },
              cause: e as Error,
            });
          }
        }

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
    toResult<InteropHandle<TransactionRequest>>(OP_INTEROP.tryCreate, () => create(p));

  // finalize → executeBundle on destination chain,
  // waits until that destination tx is mined,
  // returns finalization metadata for UI / explorers.
  const finalize = (h: InteropWaitable | Hex): Promise<InteropFinalizationResult> =>
    wrap(
      OP_INTEROP.finalize,
      async () => {
        const svc = createInteropFinalizationServices(client);

        // deriveStatus resolves bundleHash, dstChainId, etc
        const st = await svc.deriveStatus(h);
        const { bundleHash, dstChainId } = st;

        if (!bundleHash || dstChainId == null) {
          throw createError('STATE', {
            resource: 'interop',
            operation: 'interop.finalize',
            message: 'Cannot finalize: bundleHash or dstChainId not yet known / not proven.',
            context: { status: st },
          });
        }

        // submit executeBundle on destination
        const execResult = await svc.executeBundle(bundleHash, dstChainId);

        // wait for inclusion / revert surfaced as EXECUTION error
        await execResult.wait();

        const dstExecTxHash = execResult.hash;

        return {
          bundleHash,
          dstChainId,
          dstExecTxHash,
        };
      },
      {
        message: 'Failed to finalize/execute interop bundle on destination.',
        ctx: { where: 'interop.finalize' },
      },
    );

  const tryFinalize = (h: InteropWaitable | Hex) =>
    toResult<InteropFinalizationResult>(OP_INTEROP.tryFinalize, () => finalize(h));

  // status → non-blocking lifecycle inspection
  const status = (h: InteropWaitable | Hex): Promise<InteropStatus> =>
    wrap(OP_INTEROP.status, () => interopStatus(client, h), {
      message: 'Internal error while checking interop status.',
      ctx: { where: 'interop.status' },
    });

  // wait → block until "verified" or "executed"
  const wait = (
    h: InteropWaitable | Hex,
    opts: { for: 'verified' | 'executed'; pollMs?: number; timeoutMs?: number },
  ): Promise<null> =>
    wrap(OP_INTEROP.wait, () => interopWait(client, h, opts), {
      message: 'Internal error while waiting for interop execution.',
      ctx: { where: 'interop.wait', for: opts.for },
    });

  const tryWait = (
    h: InteropWaitable | Hex,
    opts: { for: 'verified' | 'executed'; pollMs?: number; timeoutMs?: number },
  ) => toResult<null>(OP_INTEROP.tryWait, () => wait(h, opts));

  return {
    quote,
    tryQuote,
    prepare,
    tryPrepare,
    create,
    tryCreate,
    finalize,
    tryFinalize,
    status,
    wait,
    tryWait,
  };
}
