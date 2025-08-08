// packages/core/src/encoding/7930.ts
import { hexToBytes, bytesToHex, concatBytes } from '@noble/hashes/utils';

const from0x = (hex: string): Uint8Array => hexToBytes(hex.startsWith('0x') ? hex.slice(2) : hex);

function beTrim(n: bigint): Uint8Array {
  if (n < 0n) throw new Error('negative bigint not supported');
  // big-endian, no leading zeros
  let hex = n.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  const bytes = hexToBytes(hex);
  let i = 0;
  while (i < bytes.length && bytes[i] === 0) i++;
  return bytes.slice(i);
}

export function encodeEvmV1(chainRef?: bigint, addr?: `0x${string}`): `0x${string}` {
  const version = new Uint8Array([0x00, 0x01]);
  const chainType = new Uint8Array([0x00, 0x00]);

  const chainRefBytes = chainRef !== undefined ? beTrim(chainRef) : new Uint8Array(0);
  if (chainRefBytes.length > 255) throw new Error('chainRef too long');
  const chainRefLen = new Uint8Array([chainRefBytes.length]);

  const addrBytes = addr ? from0x(addr) : new Uint8Array(0);
  if (addrBytes.length > 255) throw new Error('address too long');
  const addrLen = new Uint8Array([addrBytes.length]);

  const out = concatBytes(version, chainType, chainRefLen, chainRefBytes, addrLen, addrBytes);
  return `0x${bytesToHex(out)}`;
}

export function encodeEvmV1ChainOnly(chainId: number | bigint): `0x${string}` {
  return encodeEvmV1(BigInt(chainId), undefined);
}

export function encodeEvmV1AddressOnly(address: `0x${string}`): `0x${string}` {
  return encodeEvmV1(undefined, address);
}
