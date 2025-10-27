// src/adapters/ethers/resources/interop/routes/router.ts
import type { TransactionRequest } from 'ethers';
import { Contract } from 'ethers';
import type { InteropRouteStrategy, BuildCtx } from './types';
import type { InteropParams } from '../../../../../core/types/flows/interop';
import type { Address, Hex } from '../../../../../core/types/primitives';
import { AttributesEncoder } from '../attributes';
import { sumActionMsgValue, sumErc20Amounts } from '../../../../../core/resources/interop/route';
import { IERC20ABI } from '../../../../../core/internal/abi-registry';
import {
  formatInteropEvmAddress,
  formatInteropEvmChain,
} from '../../../../../core/resources/interop/address';

export function routeRouter(): InteropRouteStrategy {
  return {
    preflight(p: InteropParams, ctx: BuildCtx) {
      const hasErc20 = p.actions.some((a) => a.type === 'sendErc20');
      const baseMatches = ctx.baseTokens.src.toLowerCase() === ctx.baseTokens.dst.toLowerCase();
      if (!hasErc20 && baseMatches) {
        throw new Error(
          'route "router" requires ERC-20 actions or mismatched base tokens; use the direct route instead.',
        );
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

      const totalActionValue = sumActionMsgValue(p.actions);
      const bridgedTokenTotal = sumErc20Amounts(p.actions);

      const approvals: Array<{ token: Address; spender: Address; amount: bigint }> = [];

      // Primary spender: L2 Asset Router
      // Optional fallback: Bridgehub? todo: check contracts about this again
      const erc20Spender: Address | undefined =
        ctx.addresses.l2AssetRouter ?? ctx.addresses.bridgehub;

      for (const a of p.actions) {
        if (a.type !== 'sendErc20') continue;
        if (!erc20Spender) {
          throw new Error(
            'Missing ERC-20 spender address for router route (expected L2 Asset Router).',
          );
        }
        approvals.push({ token: a.token, spender: erc20Spender, amount: a.amount });

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

      const bundleAttrs: Hex[] = [];
      if (p.execution?.only) bundleAttrs.push(enc.executionAddress(p.execution.only));
      if (p.unbundling?.by) bundleAttrs.push(enc.unbundlerAddress(p.unbundling.by));
      if (totalActionValue > 0n) bundleAttrs.push(enc.indirectCall(totalActionValue));

      const perCallAttrs: Hex[][] = p.actions.map((a) => {
        const list: Hex[] = [];
        if (a.type === 'sendNative') list.push(enc.interopCallValue(a.amount));
        if (a.type === 'call' && a.value && a.value > 0n) list.push(enc.interopCallValue(a.value));
        return list;
      });

      const starters: Array<[Hex, Hex, Hex[]]> = p.actions.map((a, i) => {
        const to = formatInteropEvmAddress(a.to);
        if (a.type === 'sendNative') return [to, '0x' as Hex, perCallAttrs[i] ?? []];
        if (a.type === 'sendErc20') return [to, '0x' as Hex, perCallAttrs[i] ?? []];
        return [to, a.data, perCallAttrs[i] ?? []];
      });

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
        description: 'Send interop bundle (router route)',
        tx: { to: center, data, value: totalActionValue },
      });

      return {
        steps,
        approvals,
        quoteExtras: { totalActionValue, bridgedTokenTotal },
      };
    },
  };
}
