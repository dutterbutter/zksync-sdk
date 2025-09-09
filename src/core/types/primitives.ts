// Adapter-neutral primitive types used across the SDK.

export type Address = `0x${string}`;
export type Hex = `0x${string}`;
export type Hash = Hex;
export type ChainRef = number | string; // numeric chainId or semantic key

// Helpers
export type UInt = bigint;
