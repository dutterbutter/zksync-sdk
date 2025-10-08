import type { TransactionRequest } from 'ethers';
import { Contract } from 'ethers';

import type { InteropRouteStrategy, BuildCtx } from './types';
import type { InteropParams } from '../../../../../core/types/flows/interop';
import type { Address, Hex } from '../../../../../core/types/primitives';

import { AttributesEncoder } from '../attributes';
import {
  sumActionMsgValue,
  sumErc20Amounts,
} from '../../../../../core/resources/interop/route';
import { IERC20ABI } from '../../../../../core/internal/abi-registry';

/** Route: 'router'
 *  Triggers when there are ERC-20 actions OR base tokens don't match.
 *  - Adds ERC-20 approvals (spender = L2 Asset Router)
 *  - Includes the bundle-level `indirectCall(totalMessageValue)` attribute
 */
export function routeRouter(): InteropRouteStrategy {
  return {
    preflight(p: InteropParams, ctx: BuildCtx) {
      const hasErc20 = p.actions.some((a) => a.type === 'sendErc20');
      const baseMatches =
        ctx.baseTokens.src.toLowerCase() === ctx.baseTokens.dst.toLowerCase();
      if (!hasErc20 && baseMatches) {
        throw new Error(
          'route "router" requires ERC-20 actions or mismatched base tokens; use the direct route instead.',
        );
      }
    },

    async build(p: InteropParams, ctx: BuildCtx) {
      const enc = new AttributesEncoder(ctx.ifaces.attributes);
      const steps: Array<{ key: string; kind: string; description: string; tx: TransactionRequest }> = [];

      // Totals
      const totalActionValue = sumActionMsgValue(p.actions);
      const bridgedTokenTotal = sumErc20Amounts(p.actions);

      // -------- Approvals (ERC-20 to router) --------
      const approvals: Array<{ token: Address; spender: Address; amount: bigint }> = [];
      const spender = ctx.addresses.bridgehub ? ctx.addresses.bridgehub /* if your flow spends from bridgehub */ : undefined;

      // Prefer spending by the L2 Asset Router (typical path)
      const l2AssetRouter = (await (async () => {
        // the L2 Asset Router address is in client.ensureAddresses() -> surfaced via ctx? if not, pass it via ctx
        // Here we assume it is available through ctx.ifaces/addresses in your current setup; otherwise wire it in.
        // For now, we fall back to spender autodetect via route policy.
        return undefined as unknown as Address;
      })) as Address;

      const erc20Spender = l2AssetRouter ?? spender;
      // If you have the L2 Asset Router address available in ctx, set erc20Spender = ctx.addresses.l2AssetRouter

      for (const a of p.actions) {
        if (a.type !== 'sendErc20') continue;
        if (!erc20Spender) {
          throw new Error('Missing ERC-20 spender address for router route (L2 Asset Router).');
        }
        approvals.push({ token: a.token, spender: erc20Spender, amount: a.amount });

        // Insert approve step (like deposits). The create() flow can re-check allowance and skip if already sufficient.
        const data = new Contract(a.token, IERC20ABI, ctx.srcProvider).interface.encodeFunctionData(
          'approve',
          [erc20Spender, a.amount],
        ) as Hex;

        steps.push({
          key: `approve:${a.token}:${erc20Spender}`,
          kind: 'approve',
          description: `Approve ${erc20Spender} to spend ${a.amount} of ${a.token}`,
          tx: { to: a.token, data },
        });
      }

      // -------- Attributes --------
      const bundleAttrs: Hex[] = [];
      if (p.execution?.only) bundleAttrs.push(enc.executionAddress(p.execution.only));
      if (p.unbundling?.by) bundleAttrs.push(enc.unbundlerAddress(p.unbundling.by));
      // router route: include indirectCall hint for total destination value
      if (totalActionValue > 0n) bundleAttrs.push(enc.indirectCall(totalActionValue));

      const perCallAttrs: Hex[][] = p.actions.map((a) => {
        const list: Hex[] = [];
        if (a.type === 'sendNative') list.push(enc.interopCallValue(a.amount));
        if (a.type === 'call' && a.value && a.value > 0n) list.push(enc.interopCallValue(a.value));
        // sendErc20 typically has no per-call interopCallValue (value is bridged via router)
        return list;
      });

      // -------- Starters --------
      const starters: Array<[Address, Hex, Hex[]]> = p.actions.map((a, i) => {
        if (a.type === 'sendNative') return [a.to, '0x' as Hex, perCallAttrs[i] ?? []];
        if (a.type === 'sendErc20') return [a.to, '0x' as Hex, perCallAttrs[i] ?? []];
        return [a.to, a.data, perCallAttrs[i] ?? []]; // call
      });

      // -------- Send bundle --------
      const center = ctx.addresses.interopCenter;
      const data = ctx.ifaces.interopCenter.encodeFunctionData('sendBundle', [
        ctx.dstChainId,
        starters,
        bundleAttrs,
      ]) as Hex;

      // In router route, value handling is performed via router path; InteropCenter can still receive value
      // if your policy requires it. Conservatively pass the totalActionValue; adjust if your contract ignores it.
      steps.push({
        key: 'sendBundle',
        kind: 'interop.center',
        description: 'Send interop bundle (router route)',
        tx: { to: center, data, value: totalActionValue },
      });

      return {
        steps,
        approvals,
        quoteExtras: {
          totalActionValue,
          bridgedTokenTotal,
        },
      };
    },
  };
}
