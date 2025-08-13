// packages/core/src/utils.ts
import type { BundleItem, ERC7786Attribute } from './types';
import { ATTR } from './encoding/attributes';
import { encodeEvmV1AddressOnly } from './encoding/7930';
import { encodeBridgeBurnData, erc20TransferCalldata } from './internal';
import type { Hex } from './internal/hex';

/**
 * Convert a {@link BundleItem} into an Interop call starter.
 *
 * Produces `{ to, data, callAttributes }` for the contracts, plus an optional `value`
 * that contributes to the outer `msg.value` of `sendBundle`.
 *
 * @param item Bundle item (native, erc20, or remote call).
 * @param opts Optional options.
 * @param opts.assetRouter Required for **indirect** ERC-20; address of the AssetRouter.
 * @returns Object containing the encoded starter and an optional `value` to be summed into `msg.value`.
 * @throws If an indirect ERC-20 is requested without `opts.assetRouter`, or the kind is unsupported.
 *
 * @remarks
 * - Per-item `to` is encoded as **ERC-7930 address-only** (contracts require empty chainRef in bundles).
 * - Do **not** combine `ATTR.indirectCall` with `ATTR.interopCallValue` on the same call; the contracts
 *   derive/check the call value for the actual bridged call internally.
 */
export function toCallStarter(
  item: BundleItem,
  opts?: { assetRouter?: `0x${string}` },
): {
  starter: { to: Hex; data: Hex; callAttributes: Hex[] };
  value?: bigint;
} {
  if (item.kind === 'remoteCall') {
    const attrs: Hex[] = [];
    if (item.value && item.value > 0n) attrs.push(ATTR.interopCallValue(item.value));
    return {
      starter: { to: encodeEvmV1AddressOnly(item.to), data: item.data, callAttributes: attrs },
      value: item.value,
    };
  }

  if (item.kind === 'nativeTransfer') {
    const attrs: Hex[] = [ATTR.interopCallValue(item.amount)];
    return {
      starter: { to: encodeEvmV1AddressOnly(item.to), data: '0x', callAttributes: attrs },
      value: item.amount,
    };
  }

  if (item.kind === 'erc20Transfer' && item._indirect) {
    if (!opts?.assetRouter) {
      throw new Error('CONFIG_MISSING: assetRouter address is required for indirect ERC20');
    }

    const bridgeMsgValue = item._bridgeMsgValue ?? 0n;
    const attrs = [ATTR.indirectCall(bridgeMsgValue)];
    const data = encodeBridgeBurnData(item.amount, item.to, item.token);
    return {
      starter: {
        to: encodeEvmV1AddressOnly(opts.assetRouter),
        data,
        callAttributes: attrs,
      },
      value: bridgeMsgValue,
    };
  }

  if (item.kind === 'erc20Transfer') {
    const data = erc20TransferCalldata(item.to, item.amount);
    return {
      starter: { to: encodeEvmV1AddressOnly(item.token), data, callAttributes: [] },
      value: 0n,
    };
  }

  throw new Error('UNSUPPORTED_OPERATION');
}

/**
 * Merge user-provided structured attributes with extra pre-encoded attributes.
 *
 * @param base  Optional structured attributes (objects with `.data` hex).
 * @param extra Additional already-encoded attribute bytes.
 * @returns     Flat array of encoded attribute hex strings; order is `base` then `extra`.
 *
 * @remarks
 * This does not de-dupe or validate semantics; the contract enforces attribute rules.
 */
export function mergeAttributes(base: ERC7786Attribute[] | undefined, extra: Hex[]): Hex[] {
  return [...(base ?? []).map((a) => a.data), ...extra];
}

/**
 * Compute the `msg.value` to send with a bundle on chains where the base token matches.
 *
 * Sums the value-bearing contributions:
 * - `NativeTransfer.amount`
 * - `RemoteCall.value` (if present)
 * - `ERC20Transfer._bridgeMsgValue` (only for **indirect** transfers)
 *
 * Direct ERC-20 transfers contribute **0**.
 *
 * @param items Bundle items to inspect.
 * @returns     Total value as `bigint`.
 *
 * @remarks
 * When source/destination base tokens differ, **contracts require** `msg.value = 0`,
 * regardless of this total. The caller should zero the value in that case.
 */
export function computeBundleMessageValue(items: BundleItem[]): bigint {
  let total = 0n;
  for (const it of items) {
    if (it.kind === 'nativeTransfer') total += it.amount;
    else if (it.kind === 'remoteCall' && it.value) total += it.value;
    else if (it.kind === 'erc20Transfer' && it._indirect) total += it._bridgeMsgValue ?? 0n;
  }
  return total;
}
