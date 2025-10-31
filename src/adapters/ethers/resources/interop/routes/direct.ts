// src/adapters/ethers/resources/interop/routes/direct.ts
import type { TransactionRequest } from 'ethers';

import type { InteropRouteStrategy, BuildCtx } from './types';
import type { InteropParams } from '../../../../../core/types/flows/interop';
import type { Hex } from '../../../../../core/types/primitives';

import { callAttributesEncoder, bundleAttributesEncoder } from '../attributes';
import { sumActionMsgValue, sumErc20Amounts } from '../../../../../core/resources/interop/route';
import {
  formatInteropEvmAddress,
  formatInteropEvmChain,
} from '../../../../../core/resources/interop/address';

/**
 * Route: 'direct'
 *
 * Preconditions:
 *  - No ERC-20 actions present
 *  - Source and destination base tokens match
 *  - Value can be forwarded directly (no router hop / bridgehub deposit)
 *
 * Semantics:
 *  - We DO NOT mark calls as `indirectCall(...)`
 *    → InteropCenter will treat them as direct calls on destination.
 *  - For any call that carries value (sendNative, call.value),
 *    we still attach `interopCallValue(amount)` as a per-call attribute,
 *    so the destination callee can assert the forwarded msg.value.
 */
export function routeDirect(): InteropRouteStrategy {
  return {
    preflight(p: InteropParams, ctx: BuildCtx) {
      if (!p.actions?.length) {
        throw new Error('route "direct" requires at least one action.');
      }

      const hasErc20 = p.actions.some((a) => a.type === 'sendErc20');
      if (hasErc20) {
        throw new Error('route "direct" does not support ERC-20 actions; use the router route.');
      }

      const baseMatch = ctx.baseTokens.src.toLowerCase() === ctx.baseTokens.dst.toLowerCase();
      if (!baseMatch) {
        throw new Error(
          'route "direct" requires matching base tokens between source and destination.',
        );
      }

      // Basic sanity checks for value-carrying actions
      for (const a of p.actions) {
        if (a.type === 'sendNative' && a.amount < 0n) {
          throw new Error('sendNative.amount must be >= 0.');
        }
        if (a.type === 'call' && a.value != null && a.value < 0n) {
          throw new Error('call.value must be >= 0 when provided.');
        }
      }
    },
    // eslint-disable-next-line @typescript-eslint/require-await
    async build(p: InteropParams, ctx: BuildCtx) {
      const steps: Array<{
        key: string;
        kind: string;
        description: string;
        tx: TransactionRequest;
      }> = [];

      //
      // Compute totals
      //
      const totalActionValue = sumActionMsgValue(p.actions);
      const bridgedTokenTotal = sumErc20Amounts(p.actions); // will be 0n here

      //
      // Build bundle-level attributes
      //    These apply to the entire bundle and gate who can execute/unbundle
      //    on the destination chain.
      //
      const bundleAttrs: Hex[] = [];
      if (p.execution?.only) {
        bundleAttrs.push(bundleAttributesEncoder.executionAddress(p.execution.only));
      }
      if (p.unbundling?.by) {
        bundleAttrs.push(bundleAttributesEncoder.unbundlerAddress(p.unbundling.by));
      }
      // NOTE: We do NOT push indirectCall(...) here.
      // direct route never goes through initiateIndirectCall().
      //
      // Build per-call attributes
      //    For value-bearing calls we include interopCallValue(amount).
      //    No indirectCall(...) in direct mode.
      //
      const perCallAttrs: Hex[][] = p.actions.map((a) => {
        // sendNative: "just send ETH/native to this recipient on dest"
        if (a.type === 'sendNative') {
          return [callAttributesEncoder.interopCallValue(a.amount)];
        }

        // payable arbitrary call
        if (a.type === 'call' && a.value && a.value > 0n) {
          return [callAttributesEncoder.interopCallValue(a.value)];
        }

        // non-payable call / no-value
        return [];
      });

      //
      // Encode starters for sendBundle
      //
      // Each starter is:
      //   [to, data, callAttributes[]]
      //
      // `to`       becomes InteroperableAddress for the destination callee.
      // `data`     is calldata to invoke on destination.
      // `attrs[]`  are per-call attributes (like interopCallValue).
      //
      // For sendNative we use empty calldata ('0x'), meaning:
      //   "just send value to this address."
      //
      const starters: Array<[Hex, Hex, Hex[]]> = p.actions.map((a, i) => {
        const to = formatInteropEvmAddress(a.to);

        if (a.type === 'sendNative') {
          // Send raw value to recipient (no calldata).
          return [to, '0x' as Hex, perCallAttrs[i] ?? []];
        }

        if (a.type === 'call') {
          // Arbitrary call to destination contract with optional value.
          const data = a.data ?? '0x';
          return [to, data, perCallAttrs[i] ?? []];
        }

        // We should never see sendErc20 here because preflight rejects it,
        // but default defensively anyway.
        return [to, '0x' as Hex, perCallAttrs[i] ?? []];
      });

      //
      // Encode InteropCenter.sendBundle(...)
      //
      const center = ctx.addresses.interopCenter;
      const dstChain = formatInteropEvmChain(ctx.dstChainId);

      const data = ctx.ifaces.interopCenter.encodeFunctionData('sendBundle', [
        dstChain,
        starters,
        bundleAttrs,
      ]) as Hex;

      steps.push({
        key: 'sendBundle',
        kind: 'interop.center',
        description: `Send interop bundle (direct route; ${p.actions.length} actions)`,
        // In direct route, msg.value equals the total forwarded value across
        // all calls (sendNative.amount + call.value).
        tx: {
          to: center,
          data,
          value: totalActionValue,
        },
      });

      //
      // Return route plan
      //
      return {
        steps,
        approvals: [], // No ERC-20 approvals in direct route
        quoteExtras: {
          totalActionValue,
          bridgedTokenTotal,
        },
      };
    },
  };
}
