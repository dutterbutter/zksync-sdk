// packages/core/src/utils.ts
import type { BundleItem, ERC7786Attribute } from './types';
import { ATTR } from './encoding/attributes';
import { encodeEvmV1AddressOnly } from './encoding/7930';
import { bytesToHex } from '@noble/hashes/utils';
import { keccak_256 } from '@noble/hashes/sha3';

type Hex = `0x${string}`;

/** Minimal log shape used by parsers (runtime-agnostic). */
export interface LogLike {
  topics?: readonly unknown[]; // we only expect string topics, but keep defensive typing
  data?: unknown;
}

/** Precomputed topic0 for ERC-7786 MessageSent(bytes32,bytes,bytes,bytes,uint256,bytes[]) */
const MESSAGE_SENT_SIG = 'MessageSent(bytes32,bytes,bytes,bytes,uint256,bytes[])';
export const MESSAGE_SENT_TOPIC0: Hex = (() => {
  const u8 = new TextEncoder().encode(MESSAGE_SENT_SIG);
  const h = bytesToHex(keccak_256(u8));
  return (`0x${h.slice(2)}`);
})();

/**
 * Convert a BundleItem to the InteropCallStarter wire shape.
 * Pure transformation; no provider dependencies.
 */
export function toCallStarter(item: BundleItem): {
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

  if (item.kind === 'erc20Transfer') {
    const data = erc20TransferCalldata(item.to, item.amount);
    return {
      starter: { to: encodeEvmV1AddressOnly(item.token), data, callAttributes: [] },
      value: 0n,
    };
  }

  if (item.kind === 'permit') {
    return {
      starter: { to: encodeEvmV1AddressOnly(item.token), data: item.permitData, callAttributes: [] },
      value: 0n,
    };
  }

  // keep throw generic; adapters wrap with InteropError
  throw new Error('UNSUPPORTED_OPERATION');
}

/**
 * Minimal ERC-20 transfer calldata encoding.
 * selector = keccak256("transfer(address,uint256)").slice(0,4) = 0xa9059cbb
 */
export function erc20TransferCalldata(to: Hex, amount: bigint): Hex {
  const selector = 'a9059cbb';
  const toPadded = to.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const amountHex = amount.toString(16).padStart(64, '0');
  return `0x${selector}${toPadded}${amountHex}` as Hex;
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
  }
  return total;
}

// TODO: remove these helpers
function isLogLikeArray(x: unknown): x is readonly LogLike[] {
  return Array.isArray(x);
}
function isLogsContainer(x: unknown): x is { logs?: readonly LogLike[] } {
  return !!x && typeof x === 'object' && Array.isArray((x as { logs?: unknown }).logs);
}
/**
 * Extract sendId from logs of a tx receipt by recognizing the ERC-7786 MessageSent event.
 * - Prefers matching topic0 to the MessageSent signature (strict).
 * - Falls back to returning topics[1] of any log that *appears* to be MessageSent (defensive).
 *
 * Works with any receipt-like shape that exposes { logs?: LogLike[] } or a direct LogLike[].
 */
export function parseSendIdFromLogs(
  input: { logs?: readonly LogLike[] } | readonly LogLike[] | null | undefined
): Hex | undefined {
  let logs: readonly LogLike[] = [];

  if (isLogLikeArray(input)) {
    logs = input;
  } else if (isLogsContainer(input)) {
    logs = input.logs ?? [];
  } 

  for (const l of logs) {
    const topicsUnknown =
      l && typeof l === 'object' ? (l as Record<string, unknown>).topics : undefined;

    if (Array.isArray(topicsUnknown) && topicsUnknown.length >= 2) {
      const topic0 = typeof topicsUnknown[0] === 'string'
        ? topicsUnknown[0].toLowerCase()
        : '';
      if (topic0 === MESSAGE_SENT_TOPIC0.toLowerCase()) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const id = topicsUnknown[1];
        if (typeof id === 'string' && id.startsWith('0x')) return id as Hex;
      }
    }
  }

  // 2) Fallback
  for (const l of logs) {
    const topicsUnknown =
      l && typeof l === 'object' ? (l as Record<string, unknown>).topics : undefined;

    if (Array.isArray(topicsUnknown) && topicsUnknown.length >= 2) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const id = topicsUnknown[1];
      if (typeof id === 'string' && id.startsWith('0x')) return id as Hex;
    }
  }

  return undefined;
}
