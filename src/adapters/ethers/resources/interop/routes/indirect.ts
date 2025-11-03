// src/adapters/ethers/resources/interop/routes/indirect.ts

import { Contract, type TransactionRequest } from 'ethers';

import type { InteropRouteStrategy, BuildCtx } from './types';
import type { InteropParams } from '../../../../../core/types/flows/interop';
import type { Address, Hex } from '../../../../../core/types/primitives';

import { callAttributesEncoder, bundleAttributesEncoder } from '../attributes';

import { sumActionMsgValue, sumErc20Amounts } from '../../../../../core/resources/interop/route';

import { IERC20ABI } from '../../../../../core/internal/abi-registry';

import {
  formatInteropEvmAddress,
  formatInteropEvmChain,
} from '../../../../../core/resources/interop/address';

import { encodeRouterPayloadForAction } from './payload';

//TODO:
// - Update to wrap errors with ZKSyncError and codes.

/**
 * Route: 'indirect'
 *
 * Preconditions:
 *  - At least one ERC-20 action OR
 *  - Source/destination base tokens differ (so native value can't just be burned
 *    and re-materialized directly)
 *
 * Semantics:
 *  - Calls that move value (native or ERC-20) MUST go through the source chain's
 *    L2AssetRouter via `initiateIndirectCall(...)`.
 *
 *  We express that by:
 *    • Starter `to` is the LOCAL router (ctx.addresses.l2AssetRouter), not the final recipient.
 *    • Per-call attributes include BOTH:
 *        indirectCall(messageValue)
 *        interopCallValue(bridgedAmount)
 *      (wrapped via callAttributesEncoder.nativeBridge(...))
 *    • The starter `data` is a router payload (encodeRouterPayloadForAction)
 *      that tells the router who to credit on the destination and with what.
 *
 *  Bundle-level attributes (executionAddress, unbundlerAddress) still apply
 *  to the whole bundle.
 */
export function routeIndirect(): InteropRouteStrategy {
  return {
    preflight(p: InteropParams, ctx: BuildCtx) {
      const hasErc20 = p.actions.some((a) => a.type === 'sendErc20');
      const baseMatches = ctx.baseTokens.src.toLowerCase() === ctx.baseTokens.dst.toLowerCase();

      // We expect to use this route if:
      // - there's any ERC-20 bridge action, OR
      // - base tokens differ (must bridge native via router)
      if (!hasErc20 && baseMatches) {
        throw new Error(
          'route "indirect" requires ERC-20 actions or mismatched base tokens; use the direct route instead.',
        );
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
      // 1. Totals for quote context
      //
      const totalActionValue = sumActionMsgValue(p.actions);
      const bridgedTokenTotal = sumErc20Amounts(p.actions);

      //
      // 2. ERC-20 approvals (source chain)
      //
      // The router (or bridgehub fallback) needs allowance to pull ERC-20s
      // before it can escrow/lock them and synthesize finalizeDeposit(...) on dest.
      //
      const approvals: Array<{ token: Address; spender: Address; amount: bigint }> = [];

      const erc20Spender: Address | undefined =
        ctx.addresses.l2AssetRouter ?? ctx.addresses.bridgehub;
      if (!erc20Spender) {
        // If neither is present, this route can't handle ERC-20s at all.
        if (p.actions.some((a) => a.type === 'sendErc20')) {
          throw new Error('Missing ERC-20 spender address (expected L2AssetRouter or Bridgehub).');
        }
      }

      for (const a of p.actions) {
        if (a.type !== 'sendErc20') continue;
        if (!erc20Spender) continue; // already handled via throw above

        approvals.push({
          token: a.token,
          spender: erc20Spender,
          amount: a.amount,
        });

        const approveData = new Contract(
          a.token,
          IERC20ABI,
          ctx.srcProvider,
        ).interface.encodeFunctionData('approve', [erc20Spender, a.amount]) as Hex;

        steps.push({
          key: `approve:${a.token}:${erc20Spender}`,
          kind: 'approve',
          description: `Approve ${erc20Spender} to spend ${a.amount} of ${a.token}`,
          tx: {
            to: a.token,
            data: approveData,
          },
        });
      }

      //
      // 3. Bundle-level attributes
      //    These apply to the entire bundle on destination.
      //
      const bundleAttrs: Hex[] = [];
      if (p.execution?.only) {
        bundleAttrs.push(bundleAttributesEncoder.executionAddress(p.execution.only));
      }
      if (p.unbundling?.by) {
        bundleAttrs.push(bundleAttributesEncoder.unbundlerAddress(p.unbundling.by));
      }
      // NOTE: NO indirectCall(...) here. indirectCall is per-call.

      //
      // 4. Per-call attributes + starters
      //
      // Each starter is:
      //   [to, data, callAttrs[]]
      //
      // - For bridgeable / indirect actions:
      //      to    = source router (ctx.addresses.l2AssetRouter)
      //      data  = encodeRouterPayloadForAction(a, { sender, dstChainId })
      //      attrs = callAttributesEncoder.nativeBridge(messageValue, bridgedAmount)
      //
      // - For direct-able actions that happen to be in the same bundle:
      //      to    = final recipient on destination
      //      data  = raw calldata (or '0x' for plain value send)
      //      attrs = [interopCallValue(...)] if the call carries value on dest
      //
      const routerInteropAddr = ctx.addresses.l2AssetRouter
        ? formatInteropEvmAddress(ctx.addresses.l2AssetRouter)
        : undefined;

      const baseMatches = ctx.baseTokens.src.toLowerCase() === ctx.baseTokens.dst.toLowerCase();

      const starters: Array<[Hex, Hex, Hex[]]> = p.actions.map((a) => {
        //
        // Case 1: ERC-20 bridge
        //
        if (a.type === 'sendErc20') {
          if (!routerInteropAddr) {
            throw new Error('Cannot build ERC-20 starter without l2AssetRouter address.');
          }

          // ERC20 bridge: no native msg.value, but we still need an indirect hop
          // so InteropCenter routes via initiateIndirectCall(...).
          const callAttrs: Hex[] = callAttributesEncoder.nativeBridge(
            0n, // messageValue sent alongside (ETH) = 0 for pure ERC20
            a.amount, // bridgedAmount (ERC20 amount expected on dest)
          );

          const payload = encodeRouterPayloadForAction(a, {
            sender: ctx.sender,
            dstChainId: ctx.dstChainId,
          });

          return [routerInteropAddr, payload, callAttrs];
        }

        //
        // Case 2: Native bridge because base tokens differ
        //
        if (a.type === 'sendNative' && !baseMatches) {
          if (!routerInteropAddr) {
            throw new Error('Cannot build native starter without l2AssetRouter address.');
          }

          // We must indirectCall here because src/dst base tokens differ.
          // messageValue = amount we send into the router on source.
          // bridgedAmount = amount we expect to surface on destination.
          const callAttrs: Hex[] = callAttributesEncoder.nativeBridge(a.amount, a.amount);

          const payload = encodeRouterPayloadForAction(a, {
            sender: ctx.sender,
            dstChainId: ctx.dstChainId,
          });

          return [routerInteropAddr, payload, callAttrs];
        }

        //
        // Case 3: Payable arbitrary call, but base tokens differ
        //
        if (a.type === 'call' && a.value && a.value > 0n && !baseMatches) {
          if (!routerInteropAddr) {
            throw new Error('Cannot build payable-call starter without l2AssetRouter address.');
          }

          const callAttrs: Hex[] = callAttributesEncoder.nativeBridge(a.value, a.value);

          const payload = encodeRouterPayloadForAction(a, {
            sender: ctx.sender,
            dstChainId: ctx.dstChainId,
          });

          return [routerInteropAddr, payload, callAttrs];
        }

        //
        // Case 4: Direct-call-in-a-mixed-bundle.
        // Base tokens match OR there's no value to bridge,
        // so we can just execute directly on destination.
        //
        const directTo = formatInteropEvmAddress(a.to);

        if (a.type === 'sendNative') {
          // Native send where base actually matches, even though
          // the overall route is still "indirect" because some OTHER
          // action in this bundle forced us here (like an ERC20 bridge).
          return [directTo, '0x' as Hex, [callAttributesEncoder.interopCallValue(a.amount)]];
        }

        if (a.type === 'call') {
          const callAttrs: Hex[] =
            a.value && a.value > 0n ? [callAttributesEncoder.interopCallValue(a.value)] : [];
          return [directTo, a.data ?? '0x', callAttrs];
        }

        // Fallback (shouldn't really hit because we covered sendErc20 above)
        return [directTo, '0x' as Hex, []];
      });

      //
      // 5. Encode InteropCenter.sendBundle(...)
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
        description: 'Send interop bundle (indirect route)',
        tx: {
          to: center,
          data,
          // totalActionValue is the total ETH value across actions.
          // InteropCenter will forward/lock/burn appropriately:
          //  - direct calls: burnMsgValue / forward directly
          //  - indirect calls: fund initiateIndirectCall() on the router
          value: totalActionValue,
        },
      });

      //
      // 6. Return route plan
      //
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
