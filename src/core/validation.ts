import type { Address } from '../types/primitives';

export function isAddress(v: string): v is Address {
  return /^0x[0-9a-fA-F]{40}$/.test(v);
}

export function assertAddress(v: string, label = 'address'): asserts v is Address {
  if (!isAddress(v)) throw new Error(`Invalid ${label}: ${v}`);
}

export function assertPositive(n: bigint, label = 'value'): void {
  if (n < 0n) throw new Error(`Negative ${label}: ${n}`);
}
