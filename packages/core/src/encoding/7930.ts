// packages/core/src/encoding/7930.ts
import { hexToBytes, bytesToHex, concatBytes } from '../internal';
import { beTrim } from '../internal';

const from0x = (hex: string) => hexToBytes(hex as `0x${string}`);

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

export function encodeEvmV1ChainOnly(chainId: number | bigint): `0x${string}` {
  return encodeEvmV1(BigInt(chainId), undefined);
}

export function encodeEvmV1AddressOnly(address: `0x${string}`): `0x${string}` {
  return encodeEvmV1(undefined, address);
}
