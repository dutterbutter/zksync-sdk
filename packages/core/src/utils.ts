// packages/core/src/utils.ts
import type { BundleItem, ERC7786Attribute } from './types';
import { ATTR } from './encoding/attributes';
import { encodeEvmV1AddressOnly } from './encoding/7930';
import { encodeBridgeBurnData, erc20TransferCalldata } from './internal';
import type { Hex } from './internal/hex';

/**
 * Convert a BundleItem to the InteropCallStarter wire shape.
 * Pure transformation; no provider dependencies.
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
      // keep generic: the ethers layer wraps into InteropError
      throw new Error('CONFIG_MISSING: assetRouter address is required for indirect ERC20');
    }
    const attrs = [ATTR.indirectCall(item._bridgeMsgValue ?? 0n)];
    const data = encodeBridgeBurnData(item.amount, item.to, item.token); // see helper below
    return {
      starter: {
        to: encodeEvmV1AddressOnly(opts.assetRouter), // ROUTER, not token
        data,
        callAttributes: attrs,
      },
      value: item._bridgeMsgValue ?? 0n, // contributes to msg.value
    };
  }

  if (item.kind === 'erc20Transfer') {
    const data = erc20TransferCalldata(item.to, item.amount);
    return {
      starter: { to: encodeEvmV1AddressOnly(item.token), data, callAttributes: [] },
      value: 0n,
    };
  }

  if (item.kind === 'permit') {
    return {
      starter: {
        to: encodeEvmV1AddressOnly(item.token),
        data: item.permitData,
        callAttributes: [],
      },
      value: 0n,
    };
  }

  // keep throw generic; adapters wrap with InteropError
  throw new Error('UNSUPPORTED_OPERATION');
}

/** Merge user-provided structured attributes with extra encoded attributes. */
export function mergeAttributes(base: ERC7786Attribute[] | undefined, extra: Hex[]): Hex[] {
  return [...(base ?? []).map((a) => a.data), ...extra];
}

/** Sum of value-bearing items (remoteCall.value + nativeTransfer.amount). */
export function computeBundleMessageValue(items: BundleItem[]): bigint {
  let total = 0n;
  for (const it of items) {
    if (it.kind === 'nativeTransfer') total += it.amount;
    else if (it.kind === 'remoteCall' && it.value) total += it.value;
    else if (it.kind === 'erc20Transfer' && it._indirect) total += it._bridgeMsgValue ?? 0n;
  }
  return total;
}
