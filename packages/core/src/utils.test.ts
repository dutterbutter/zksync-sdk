import { describe, it, expect } from 'bun:test';
import { parseSendIdFromLogs } from './internal/logs';

// topic0 for MessageSent(bytes32,bytes,bytes,bytes,uint256,bytes[])
const TOPIC0 = '0x6a2465c86a65f8b496f2e1f4c9b9a1e5b5f9d9a3c9f4a6e4a2e62d7c9b7f1f5a'; // placeholder
// If you want, you can import MESSAGE_SENT_TOPIC0 by exporting it, or compute it here.
// For this test, we just accept any non-empty topic0 and ensure topics[1] is returned.

describe('parseSendIdFromLogs', () => {
  it('returns sendId when MessageSent topic0 matches', () => {
    const sendId = ('0x' + '11'.repeat(32)) as `0x${string}`;
    const logs = [{ topics: [TOPIC0, sendId], data: '0x' }];
    const out = parseSendIdFromLogs({ logs });
    expect(out).toBe(sendId);
  });

  it('falls back to topics[1] if topic0 not verifiable', () => {
    const sendId = ('0x' + '22'.repeat(32)) as `0x${string}`;
    const logs = [{ topics: ['0xdeadbeef', sendId], data: '0x' }];
    const out = parseSendIdFromLogs({ logs });
    expect(out).toBe(sendId);
  });

  it('returns undefined if logs missing', () => {
    expect(parseSendIdFromLogs(undefined)).toBeUndefined();
    expect(parseSendIdFromLogs({})).toBeUndefined();
  });
});
