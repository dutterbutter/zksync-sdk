// src/adapters/ethers/resources/interop/routes/direct.ts
import type { TransactionRequest } from 'ethers';

import type { InteropRouteStrategy, BuildCtx } from './types';
import type { InteropParams } from '../../../../../core/types/flows/interop';
import type { Hex } from '../../../../../core/types/primitives';

import { AttributesEncoder } from '../attributes';
import { sumActionMsgValue, sumErc20Amounts } from '../../../../../core/resources/interop/route';
import {
  formatInteropEvmAddress,
  formatInteropEvmChain,
} from '../../../../../core/resources/interop/address';

/** Route: 'direct'
 *  Preconditions:
 *   - No ERC-20 actions present
 *   - Source and destination base tokens match
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

      const match = ctx.baseTokens.src.toLowerCase() === ctx.baseTokens.dst.toLowerCase();
      if (!match) {
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
      const enc = new AttributesEncoder(ctx.ifaces.attributes);
      const steps: Array<{
        key: string;
        kind: string;
        description: string;
        tx: TransactionRequest;
      }> = [];

      // Totals
      const totalActionValue = sumActionMsgValue(p.actions);
      const bridgedTokenTotal = sumErc20Amounts(p.actions);

      // Bundle-level attributes (executor / unbundler)
      const bundleAttrs: Hex[] = [];
      if (p.execution?.only) bundleAttrs.push(enc.executionAddress(p.execution.only));
      if (p.unbundling?.by) bundleAttrs.push(enc.unbundlerAddress(p.unbundling.by));
      // NOTE: NO indirectCall in direct route.

      // Per-call attributes (interopCallValue for value-carrying calls)
      const perCallAttrs: Hex[][] = p.actions.map((a) => {
        const list: Hex[] = [];
        if (a.type === 'sendNative') list.push(enc.interopCallValue(a.amount));
        if (a.type === 'call' && a.value && a.value > 0n) list.push(enc.interopCallValue(a.value));
        return list;
      });

      // Encode starters: (to, data, attributes)
      const starters: Array<[Hex, Hex, Hex[]]> = p.actions.map((a, i) => {
        const to = formatInteropEvmAddress(a.to);
        switch (a.type) {
          case 'sendNative':
            // Send value to a receiver contract on dst.
            return [to, '0x' as Hex, perCallAttrs[i] ?? []];

          case 'call':
            return [to, a.data ?? ('0x' as Hex), perCallAttrs[i] ?? []];

          default:
            return [to, '0x' as Hex, perCallAttrs[i] ?? []];
        }
      });

      // Choose sendCall vs sendBundle – single pure call can be sendCall
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
        // In direct route, msg.value equals total destination msg.value
        tx: { to: center, data, value: totalActionValue },
      });

      return {
        steps,
        approvals: [], // none in direct route
        quoteExtras: {
          totalActionValue,
          bridgedTokenTotal,
        },
      };
    },
  };
}
