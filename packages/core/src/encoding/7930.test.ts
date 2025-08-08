import { describe, it, expect } from 'bun:test';
import { encodeEvmV1, encodeEvmV1ChainOnly, encodeEvmV1AddressOnly } from './7930';
import { hexToBytes, bytesToHex } from '../internal/hex';

const to0x = (u8: Uint8Array) => bytesToHex(u8);
const from0x = (h: string) => hexToBytes(h as `0x${string}`);

describe('encodeEvmV1ChainOnly', () => {
  it('encodes version, chainType, chainRefLen, chainRef, addrLen=0', () => {
    const hex = encodeEvmV1ChainOnly(1);
    const b = from0x(hex);
    // [00 01] version, [00 00] chainType, [01] chainRefLen, [01] chainRef, [00] addrLen
    expect(Array.from(b)).toEqual([0x00, 0x01, 0x00, 0x00, 0x01, 0x01, 0x00]);
  });
});

describe('encodeEvmV1AddressOnly', () => {
  it('encodes address only (chainRefLen=0, addrLen=20 + address)', () => {
    const addr = '0x1111111111111111111111111111111111111111' as const;
    const hex = encodeEvmV1AddressOnly(addr);
    const b = from0x(hex);

    // prefix bytes
    expect(b.slice(0, 5)).toEqual(Uint8Array.from([0x00, 0x01, 0x00, 0x00, 0x00])); // version, type, chainRefLen=0
    expect(b[5]).toBe(0x14); // addrLen = 20

    // address bytes
    const addrBytes = b.slice(6);
    expect(addrBytes.length).toBe(20);
    // compare as hex strings
    expect(to0x(addrBytes)).toBe(to0x(from0x(addr)));
  });
});

describe('encodeEvmV1(chain, addr)', () => {
  it('encodes both chainRef and address when provided', () => {
    const addr = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as const;
    const hex = encodeEvmV1(1n, addr);
    const b = from0x(hex);

    // version + chainType + chainRefLen + chainRef + addrLen + address
    // 00 01 | 00 00 | 01 | 01 | 14 | <20 bytes>
    expect(b[0]).toBe(0x00);
    expect(b[1]).toBe(0x01);
    expect(b[2]).toBe(0x00);
    expect(b[3]).toBe(0x00);
    expect(b[4]).toBe(0x01); // chainRefLen
    expect(b[5]).toBe(0x01); // chainRef value (big-endian 1)
    expect(b[6]).toBe(0x14); // addrLen
    // compare as hex strings
    expect(to0x(b.slice(7))).toBe(to0x(from0x(addr)));
  });
});
