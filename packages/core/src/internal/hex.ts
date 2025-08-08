// packages/core/src/internal/hex.ts
import {
  hexToBytes as nobleHexToBytes,
  bytesToHex as nobleBytesToHex,
  concatBytes as nobleConcatBytes,
} from '@noble/hashes/utils';

export type Hex = `0x${string}`;

export const strip0x = (h: string) => (h.startsWith('0x') || h.startsWith('0X') ? h.slice(2) : h);
export const add0x = (h: string): Hex => `0x${strip0x(h)}`;

export const hexToBytes = (h: string) => nobleHexToBytes(strip0x(h));
export const bytesToHex = (u8: Uint8Array): Hex => `0x${nobleBytesToHex(u8)}`;
export const concatBytes = (...parts: Uint8Array[]) => nobleConcatBytes(...parts);

export function readAsBigHex(u8: Uint8Array, start: number, len: number): Hex | undefined {
  if (start < 0 || len < 0 || start + len > u8.length) return undefined;
  return bytesToHex(u8.subarray(start, start + len)); // already 0x-prefixed
}
