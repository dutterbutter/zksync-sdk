// packages/core/src/encoding/7930.ts
import { hexToBytes, bytesToHex, concatBytes } from '../internal';
import { beTrim } from '../internal';

const from0x = (hex: string) => hexToBytes(hex as `0x${string}`);


/**
 * Encode an ERC-7930 EVM v1 interoperable address.
 *
 * Layout: `[version(2) | chainType(2) | chainRefLen(1) | chainRef | addrLen(1) | addr]`
 *
 * - `version`      – currently `0x0001` (big-endian) to indicate EVM v1.
 * - `chainType`    – reserved for future use; fixed `0x0000` for EVM.
 * - `chainRef`     – big-endian, length ≤ 255 bytes (typically an EIP-155 chain id).
 * - `addr`         – raw 20-byte EVM address; length ≤ 255 bytes (20 in practice).
 *
 * @param chainRef Optional chain reference (EIP-155 chain id). Omit for **address-only**.
 * @param addr     Optional EVM address (`0x…`). Omit for **chain-only**.
 * @returns        Hex‐encoded interoperable address (`0x…`).
 * @throws         If `chainRef` or `addr` exceed 255 bytes when serialized.
 *
 * @remarks
 * - **Chain-only** (destination in `sendBundle`): pass `chainRef`, leave `addr` undefined.
 * - **Address-only** (per-call `to` in bundle items): pass `addr`, leave `chainRef` undefined.
 * - Empty/omitted halves are **required** by the contracts for the intended context.
 *
 * @example
 * // Chain-only for destination (EIP-155)
 * const dst = encodeEvmV1( BigInt(324), undefined );
 *
 * // Address-only for a call starter
 * const to  = encodeEvmV1( undefined, '0xabc…def' );
 */
export function encodeEvmV1(chainRef?: bigint, addr?: `0x${string}`): `0x${string}` {
  // TODO: indirect needs "const version   = new Uint8Array([0x01, 0x00]);" ??
  // native / direct transfers need: const version = new Uint8Array([0x00, 0x01]);
  const version = new Uint8Array([0x00, 0x01]);
  const chainType = new Uint8Array([0x00, 0x00]);

  const chainRefBytes = chainRef !== undefined ? beTrim(chainRef) : new Uint8Array(0);
  if (chainRefBytes.length > 255) throw new Error('chainRef too long');
  const chainRefLen = new Uint8Array([chainRefBytes.length]);

  const addrBytes = addr ? from0x(addr) : new Uint8Array(0);
  if (addrBytes.length > 255) throw new Error('address too long');
  const addrLen = new Uint8Array([addrBytes.length]);

  const out = concatBytes(version, chainType, chainRefLen, chainRefBytes, addrLen, addrBytes);
  return bytesToHex(out);
}

/**
 * Encode a **chain-only** ERC-7930 address (destination for `sendBundle`).
 *
 * @param chainId EIP-155 chain id.
 * @returns       Chain-only interoperable address.
 */
export function encodeEvmV1ChainOnly(chainId: number | bigint): `0x${string}` {
  return encodeEvmV1(BigInt(chainId), undefined);
}


/**
 * Encode an **address-only** ERC-7930 address (per-call `to` for bundles).
 *
 * @param address EVM address (`0x…`).
 * @returns       Address-only interoperable address.
 */
export function encodeEvmV1AddressOnly(address: `0x${string}`): `0x${string}` {
  return encodeEvmV1(undefined, address);
}
