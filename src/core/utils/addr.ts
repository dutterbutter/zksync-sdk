import type { Address, Hex } from '../types/primitives.ts';
import { FORMAL_ETH_ADDRESS, ETH_ADDRESS, L2_BASE_TOKEN_ADDRESS } from '../constants.ts';

import { keccak_256 } from '@noble/hashes/sha3';
import { utf8ToBytes, bytesToHex } from '@noble/hashes/utils';

// Returns true if the string is a 0x-prefixed hex of length 66 (32 bytes + '0x')
export const isHash66 = (x?: string): x is Hex => !!x && x.startsWith('0x') && x.length === 66;

/** Keccak-256 of a string, returned as lowercase 0x-prefixed hex. */
export const k256hex = (s: string): Hex =>
  `0x${bytesToHex(keccak_256(utf8ToBytes(s)))}`.toLowerCase() as Hex;

// Compares two addresses for equality, ignoring case
export function isAddressEq(a: Address, b: Address): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

// Returns true if the address is any of the known ETH aliases
export function isETH(token: Address) {
  return (
    isAddressEq(token, FORMAL_ETH_ADDRESS) ||
    isAddressEq(token, L2_BASE_TOKEN_ADDRESS) ||
    isAddressEq(token, ETH_ADDRESS)
  );
}

// Compares two addresses for equality, ignoring case and '0x' prefix
export function normalizeAddrEq(a?: string, b?: string): boolean {
  if (!a || !b) return false;

  const normalize = (s: string) => {
    // Treat "0x" or "0X" as prefix
    const hasPrefix = s.slice(0, 2).toLowerCase() === '0x';
    const body = hasPrefix ? s.slice(2) : s;
    return `0x${body.toLowerCase()}`;
  };

  return normalize(a) === normalize(b);
}
