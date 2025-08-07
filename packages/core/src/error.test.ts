import { describe, it, expect } from 'bun:test';
import { parseRevertData } from './errors';
import { bytesToHex } from '@noble/hashes/utils';

// helper to build Error(string) data
function errorStringHex(s: string): `0x${string}` {
  const enc = new TextEncoder().encode(s);
  const len = enc.length;
  const padLen = (32 - (len % 32 || 32)) % 32;

  const selector = '08c379a0';
  const offset   = (32).toString(16).padStart(64, '0');   // 0x20 as 32-byte word
  const length   = len.toString(16).padStart(64, '0');    // string length as 32-byte word
  const dataHex  = bytesToHex(enc);                       // no 0x
  const padding  = '00'.repeat(padLen);

  return (`0x${selector}${offset}${length}${dataHex}${padding}`) as `0x${string}`;
}

describe('parseRevertData', () => {
  it('decodes Error(string)', () => {
    const data = errorStringHex('boom');
    const d = parseRevertData(data)!;
    expect(d.code).toBe('EVM_ERROR');
    expect(d.name).toBe('Error(string)');
    expect(d.args?.message).toBe('boom');
  });

  it('maps custom selector Unknown → SEND_FAILED', () => {
    const data = ('0xdeadbeef' + '00'.repeat(32)) as `0x${string}`;
    const d = parseRevertData(data)!;
    expect(d.code).toBe('SEND_FAILED');
    expect(d.name).toBe('UnknownRevert');
  });
});
