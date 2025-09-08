// Adapter-neutral primitive types used across the SDK.

export type Address = `0x${string}`;
export type Hex = `0x${string}`;
export type Hash = Hex;
export type ChainRef = number | string; // numeric chainId or semantic key

// Conventional ETH sentinel (documented; normalized in one place).
export const ETH_SENTINEL = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as Address;

// Conventional ETH address (documented; normalized in one place).
export const ETH_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

/**
 * In the contracts the zero address can not be used, use one instead
 * @readonly
 */
export const ETH_ADDRESS_IN_CONTRACTS = '0x0000000000000000000000000000000000000001' as Address;

// Conventional L2 ETH address (documented; normalized in one place).
export const L2_ETH_ADDRESS = '0x000000000000000000000000000000000000800a' as Address;

// Helpers
export type UInt = bigint;
