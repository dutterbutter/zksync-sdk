// packages/core/src/internal/abi.ts
import { keccak_256 } from '@noble/hashes/sha3';
import { hexToBytes, bytesToHex, concatBytes } from './hex';
import type { Hex } from './hex';
import { u256Bytes } from './bytes';

export function encodeSelector(signature: string): Uint8Array {
  return keccak_256(new TextEncoder().encode(signature)).slice(0, 4);
}

/** Minimal ABI encoder for functions using only (uint256 | bytes). */
export function encodeFunctionData(
  signature: string,
  argKinds: ReadonlyArray<'uint256' | 'bytes'>,
  args: unknown[],
): Hex {
  if (argKinds.length !== args.length) {
    throw new Error(`arg length mismatch: expected ${argKinds.length}, got ${args.length}`);
  }
  const sel = encodeSelector(signature);

  const heads: Uint8Array[] = [];
  const tails: Uint8Array[] = [];
  let dynamicOffset = 32 * argKinds.length;

  for (let i = 0; i < argKinds.length; i++) {
    const kind = argKinds[i];
    const arg = args[i];

    if (kind === 'uint256') {
      const v = typeof arg === 'bigint' ? arg : BigInt(arg as string | number);
      heads.push(u256Bytes(v));
    } else if (kind === 'bytes') {
      heads.push(u256Bytes(BigInt(dynamicOffset)));

      const data: Uint8Array = typeof arg === 'string' ? hexToBytes(arg) : (arg as Uint8Array);
      const len = u256Bytes(BigInt(data.length));
      const padLen = (32 - (data.length % 32 || 32)) % 32;
      const padded = padLen ? concatBytes(data, new Uint8Array(padLen)) : data;

      tails.push(concatBytes(len, padded));
      dynamicOffset += 32 + padded.length;
    } else {
      throw new Error(`Unsupported type: ${kind as string}`);
    }
  }

  const body = concatBytes(...heads, ...tails);
  return bytesToHex(concatBytes(sel, body));
}
