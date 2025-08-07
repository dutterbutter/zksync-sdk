/// <reference types="bun-types" />

import { describe, it, expect } from 'bun:test';
import { ATTR } from './attributes';
import { encodeEvmV1AddressOnly } from './7930';
import { keccak_256 } from '@noble/hashes/sha3';
import { hexToBytes, bytesToHex } from '@noble/hashes/utils';

// helpers
const from0x = (hex: string) => hexToBytes(hex.startsWith('0x') ? hex.slice(2) : hex);
const to0x = (u8: Uint8Array) => `0x${bytesToHex(u8)}`;

function u256(n: bigint): Uint8Array {
  if (n < 0n) throw new Error('uint256 underflow');
  let hex = n.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  const src = from0x(hex);
  if (src.length > 32) throw new Error('uint256 overflow');
  const out = new Uint8Array(32);
  out.set(src, 32 - src.length);
  return out;
}

function selector(sig: string): Uint8Array {
  return keccak_256(new TextEncoder().encode(sig)).slice(0, 4);
}

describe('ATTR.interopCallValue(uint256)', () => {
  it('encodes selector + 32-byte value', () => {
    const enc = ATTR.interopCallValue(123n);
    const bytes = from0x(enc);

    // 4-byte selector
    const sel = selector('interopCallValue(uint256)');
    expect(to0x(bytes.slice(0, 4))).toBe(to0x(sel));

    // one 32-byte head argument: uint256(123)
    expect(bytes.length).toBe(4 + 32);
    expect(to0x(bytes.slice(4))).toBe(to0x(u256(123n)));
  });
});

describe('ATTR.indirectCall(uint256)', () => {
  it('encodes selector + 32-byte value', () => {
    const enc = ATTR.indirectCall(5n);
    const bytes = from0x(enc);

    const sel = selector('indirectCall(uint256)');
    expect(to0x(bytes.slice(0, 4))).toBe(to0x(sel));

    expect(bytes.length).toBe(4 + 32);
    expect(to0x(bytes.slice(4))).toBe(to0x(u256(5n)));
  });
});

describe('ATTR.executionAddress(bytes)', () => {
  it('encodes dynamic bytes (offset, len, data, padding)', () => {
    const addr = '0x1111111111111111111111111111111111111111' as const;
    const evm7930 = encodeEvmV1AddressOnly(addr);
    const evmBytes = from0x(evm7930);

    const enc = ATTR.executionAddress(evm7930);
    const bytes = from0x(enc);

    // selector
    const sel = selector('executionAddress(bytes)');
    expect(to0x(bytes.slice(0, 4))).toBe(to0x(sel));

    // Head (single arg): offset to tail = 0x20
    const head = bytes.slice(4, 4 + 32);
    expect(to0x(head)).toBe(to0x(u256(32n)));

    // Tail: [len][data][padding]
    const lenU256 = bytes.slice(4 + 32, 4 + 64);
    const len = BigInt('0x' + bytesToHex(lenU256));
    expect(len).toBe(BigInt(evmBytes.length));

    const tailDataStart = 4 + 64;
    const tailDataEnd = tailDataStart + Number(len);
    const data = bytes.slice(tailDataStart, tailDataEnd);
    expect(to0x(data)).toBe(to0x(evmBytes));

    // Padding to 32-byte boundary
    const pad = (32 - (Number(len) % 32 || 32)) % 32;
    const padding = bytes.slice(tailDataEnd);
    expect(padding.length).toBe(pad);
    if (pad) expect(Array.from(padding).every((x) => x === 0)).toBe(true);
  });
});

describe('ATTR.unbundlerAddress(bytes)', () => {
  it('encodes dynamic bytes same as executionAddress', () => {
    const addr = '0x2222222222222222222222222222222222222222' as const;
    const evm7930 = encodeEvmV1AddressOnly(addr);
    const evmBytes = from0x(evm7930);

    const enc = ATTR.unbundlerAddress(evm7930);
    const bytes = from0x(enc);

    const sel = selector('unbundlerAddress(bytes)');
    expect(to0x(bytes.slice(0, 4))).toBe(to0x(sel));

    // offset = 0x20
    expect(to0x(bytes.slice(4, 36))).toBe(to0x(u256(32n)));

    // length
    const lenU256 = bytes.slice(36, 68);
    const len = BigInt('0x' + bytesToHex(lenU256));
    expect(len).toBe(BigInt(evmBytes.length));

    // data
    expect(to0x(bytes.slice(68, 68 + Number(len)))).toBe(to0x(evmBytes));
  });
});
