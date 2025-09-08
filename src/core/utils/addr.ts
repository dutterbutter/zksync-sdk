import type { Address, Hex } from '../types/primitives.ts';
import {
  ETH_ADDRESS_IN_CONTRACTS,
  LEGACY_ETH_ADDRESS,
  L2_BASE_TOKEN_ADDRESS,
} from '../constants.ts';

export const isHash66 = (x?: string): x is Hex => !!x && x.startsWith('0x') && x.length === 66;

/**
 * Compares stringified addresses, taking into account the fact that
 * addresses might be represented in different casing.
 *
 * @param a - The first address to compare.
 * @param b - The second address to compare.
 * @returns A boolean indicating whether the addresses are equal.
 *
 * @example
 *
 * import { utils } from "zksync-ethers";
 *
 * const address1 = "0x36615Cf349d7F6344891B1e7CA7C72883F5dc049";
 * const address2 = "0x36615cf349d7f6344891b1e7ca7c72883f5dc049";
 * const isEqual = utils.isAddressEq(address1, address2);
 * // true
 */
export function isAddressEq(a: Address, b: Address): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Returns true if token represents ETH on L1 or L2.
 *
 * @param token The token address.
 *
 * @example
 *
 * import { utils } from "zksync-ethers";
 *
 * const isL1ETH = utils.isETH(utils.ETH_ADDRESS); // true
 * const isL2ETH = utils.isETH(utils.ETH_ADDRESS_IN_CONTRACTS); // true
 */
export function isETH(token: Address) {
  return (
    isAddressEq(token, LEGACY_ETH_ADDRESS) ||
    isAddressEq(token, L2_BASE_TOKEN_ADDRESS) ||
    isAddressEq(token, ETH_ADDRESS_IN_CONTRACTS)
  );
}

export function normalizeAddrEq(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const n = (s: string) => (s.startsWith('0x') ? s.toLowerCase() : `0x${s.toLowerCase()}`);
  return n(a) === n(b);
}
