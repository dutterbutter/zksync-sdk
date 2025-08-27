// packages/core/src/internal/bytes.ts
import { hexToBytes } from './hex';

export function pad32(u8: Uint8Array): Uint8Array {
  if (u8.length > 32) throw new Error('pad32 overflow');
  const out = new Uint8Array(32);
  out.set(u8, 32 - u8.length);
  return out;
}

export function beTrim(n: bigint): Uint8Array {
  if (n < 0n) throw new Error('negative bigint not supported');
  let hex = n.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  const bytes = hexToBytes(hex);
  let i = 0;
  while (i < bytes.length && bytes[i] === 0) i++;
  return bytes.slice(i);
}

export function u256Bytes(n: bigint): Uint8Array {
  if (n < 0n) throw new Error('uint256 underflow');
  let hex = n.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  const raw = hexToBytes(hex);
  if (raw.length > 32) throw new Error('uint256 overflow');
  return pad32(raw);
}
