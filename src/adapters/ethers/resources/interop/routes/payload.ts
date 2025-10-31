// src/adapters/ethers/resources/interop/routes/payload.ts

import { AbiCoder } from 'ethers';
import type { Hex, Address } from '../../../../../core/types/primitives';
import type { InteropAction } from '../../../../../core/types/flows/interop';

/**
 * We send `_data` into L2AssetRouter.initiateIndirectCall(...) on the source chain.
 *
 * The router will decode this blob, lock/burn/escrow funds or pull ERC20,
 * and then synthesize the *destination-side* call to its peer router
 * (typically finalizeDeposit(...) or equivalent).
 *
 * This payload must contain enough info for the destination router to:
 *  - know WHICH asset is being bridged (native vs ERC20),
 *  - know HOW MUCH,
 *  - know WHO should receive on destination,
 *  - optionally, know HOW to post-process (ex: run a call with value).
 *
 * We standardize on a leading `kind: uint8` tag so we can extend formats
 * without breaking decoding. Contracts should `switch(kind)` on decode.
 */
export enum RouterPayloadKind {
  NativeTransfer = 0,
  Erc20Transfer = 1,
  CallWithValue = 2,
}

/**
 * Params needed to build a router payload for a single action.
 *
 * sender:
 *   The caller / originator on the source chain (usually p.sender or signer address).
 *   The router may need this for attribution, refunds, or auditing.
 *
 * dstChainId:
 *   The destination chain EIP-155 ID.
 *   Routers often stamp this into the finalizeDeposit payload so the far side
 *   can verify provenance or route asset IDs correctly.
 */
export interface RouterPayloadContext {
  sender: Address;
  dstChainId: bigint;
}

/**
 * Encodes the router payload for a sendNative action across base-mismatched chains.
 *
 * Shape (Solidity tuple suggestion):
 *   kind            uint8    = RouterPayloadKind.NativeTransfer (0)
 *   dstChainId      uint256
 *   recipientOnDst  address  = where the bridged native value should ultimately land
 *   amountWei       uint256  = how much native value should be minted/released on dst
 *   originSender    address  = msg.sender on source (for auditing / refunds)
 */
function encodeNativePayload(args: {
  dstChainId: bigint;
  recipientOnDst: Address;
  amountWei: bigint;
  originSender: Address;
}): Hex {
  const coder = AbiCoder.defaultAbiCoder();
  return coder.encode(
    ['uint8', 'uint256', 'address', 'uint256', 'address'],
    [
      RouterPayloadKind.NativeTransfer,
      args.dstChainId,
      args.recipientOnDst,
      args.amountWei,
      args.originSender,
    ],
  ) as Hex;
}

/**
 * Encodes the router payload for a sendErc20 action.
 *
 * Shape (Solidity tuple suggestion):
 *   kind            uint8    = RouterPayloadKind.Erc20Transfer (1)
 *   dstChainId      uint256
 *   token           address  = ERC-20 token on source (or canonical asset ID source-side)
 *   amount          uint256  = amount of that token to bridge
 *   recipientOnDst  address  = who gets credited/minted on destination
 *   originSender    address  = msg.sender on source
 *
 * NOTE:
 *   The router will already have allowance (we inserted `approve()` before),
 *   so it can pull `amount` of `token`, escrow/burn it, and later mint/release
 *   equivalent value on destination.
 */
function encodeErc20Payload(args: {
  dstChainId: bigint;
  token: Address;
  amount: bigint;
  recipientOnDst: Address;
  originSender: Address;
}): Hex {
  const coder = AbiCoder.defaultAbiCoder();
  return coder.encode(
    ['uint8', 'uint256', 'address', 'uint256', 'address', 'address'],
    [
      RouterPayloadKind.Erc20Transfer,
      args.dstChainId,
      args.token,
      args.amount,
      args.recipientOnDst,
      args.originSender,
    ],
  ) as Hex;
}

/**
 * Encodes the router payload for a "call" action that needs value bridged
 * before running arbitrary logic on the destination chain.
 *
 * This is the "bridge then invoke contract.function{value:...}(calldata)" case.
 *
 * Shape (Solidity tuple suggestion):
 *   kind            uint8    = RouterPayloadKind.CallWithValue (2)
 *   dstChainId      uint256
 *   targetOnDst     address  = contract to call on destination
 *   callValueWei    uint256  = msg.value the destination call should receive
 *   callData        bytes    = calldata for that destination contract
 *   originSender    address  = msg.sender on source (identity / permissions)
 *
 * Notes:
 *   - This assumes the bridged asset is the destination base token.
 *     If instead you're doing "bridge ERC20 then execute a custom function
 *     that consumes those tokens", you'd likely extend this format with `token`
 *     and `amount`. You can add RouterPayloadKind variants for that later.
 */
function encodeCallWithValuePayload(args: {
  dstChainId: bigint;
  targetOnDst: Address;
  callValueWei: bigint;
  callData: Hex;
  originSender: Address;
}): Hex {
  const coder = AbiCoder.defaultAbiCoder();
  return coder.encode(
    ['uint8', 'uint256', 'address', 'uint256', 'bytes', 'address'],
    [
      RouterPayloadKind.CallWithValue,
      args.dstChainId,
      args.targetOnDst,
      args.callValueWei,
      args.callData,
      args.originSender,
    ],
  ) as Hex;
}

/**
 * Main entrypoint.
 *
 * Given a high-level `InteropAction` ("sendNative", "sendErc20", "call"),
 * plus contextual info (sender, dstChainId),
 * produce the `_data` blob we pass to L2AssetRouter.initiateIndirectCall(...).
 *
 * This is only used by the "indirect" route builder.
 */
export function encodeRouterPayloadForAction(
  action: InteropAction,
  ctx: RouterPayloadContext,
): Hex {
  switch (action.type) {
    case 'sendNative': {
      // We’re bridging native (or base token) value to `action.to` on dst.
      // The router will finalizeDeposit(...) on destination and credit/mint
      // `action.amount` to that recipient.
      return encodeNativePayload({
        dstChainId: ctx.dstChainId,
        recipientOnDst: action.to,
        amountWei: action.amount,
        originSender: ctx.sender,
      });
    }

    case 'sendErc20': {
      // We’re bridging ERC-20 tokens. We already added an approve()
      // so the router can pull `action.amount` of `action.token`.
      // The destination side should mint/credit those tokens to `action.to`.
      return encodeErc20Payload({
        dstChainId: ctx.dstChainId,
        token: action.token,
        amount: action.amount,
        recipientOnDst: action.to,
        originSender: ctx.sender,
      });
    }

    case 'call': {
      // We're saying:
      //   "Bridge enough value (if any), then on destination
      //    call `action.to` with `action.data` and that value."
      //
      // If `action.value` is undefined or 0n, this reduces to "invoke a pure call".
      // We still encode it with CallWithValue and pass 0 for callValueWei.
      // The destination router can branch on zero vs nonzero.
      const forwardedValue = action.value ?? 0n;
      return encodeCallWithValuePayload({
        dstChainId: ctx.dstChainId,
        targetOnDst: action.to,
        callValueWei: forwardedValue,
        callData: action.data ?? '0x',
        originSender: ctx.sender,
      });
    }

    default: {
      // TypeScript exhaustive check protection. If a new InteropAction type
      // gets added and not handled, we'll fall back to "0x" but you should
      // update the switch.
      return '0x' as Hex;
    }
  }
}
