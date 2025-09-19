/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'bun:test';
import { createZksRpc, normalizeProof } from '../zks';
import type { RpcTransport } from '../types';
import { isZKsyncError } from '../../types/errors';

// Minimal transport fake (map method -> value or function)
function fakeTransport(map: Record<string, any | ((...p: any[]) => any)>): RpcTransport {
  return (method, params = []) => {
    const handler = map[method];
    if (handler === undefined) return Promise.reject(new Error(`unexpected method: ${method}`));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const result = typeof handler === 'function' ? handler(...params) : handler;
    return Promise.resolve(result);
  };
}

describe('rpc/zks.normalizeProof', () => {
  it('normalizes id/index and batch_number/batchNumber with string/number/bigint', () => {
    const a = normalizeProof({
      id: '1',
      batch_number: '2',
      proof: [('0x' + '00'.repeat(32)) as `0x${string}`],
    });
    expect(a).toEqual({
      id: 1n,
      batchNumber: 2n,
      proof: [('0x' + '00'.repeat(32)) as `0x${string}`],
    });

    const b = normalizeProof({
      index: 3,
      batchNumber: 4n,
      proof: ['0x1', '0x2'],
    });
    expect(b).toEqual({
      id: 3n,
      batchNumber: 4n,
      proof: ['0x1', '0x2'],
    });
  });

  it('throws ZKsyncError for missing id or batch number', () => {
    try {
      normalizeProof({ proof: [] });
      throw new Error('expected to throw');
    } catch (e) {
      expect(isZKsyncError(e)).toBe(true);
      expect(String(e)).toContain('Malformed proof: missing id or batch number');
    }
  });

  it('throws ZKsyncError for invalid numeric field types', () => {
    try {
      normalizeProof({ id: {}, batch_number: 1, proof: [] });
      throw new Error('expected to throw');
    } catch (e) {
      expect(isZKsyncError(e)).toBe(true);
      expect(String(e)).toContain('Malformed proof: invalid numeric field');
    }
  });
});

describe('rpc/zks.getBridgehubAddress', () => {
  it('returns a hex address when RPC responds with a 0x-prefixed string', async () => {
    const rpc = createZksRpc(
      fakeTransport({ zks_getBridgehubContract: '0x1234567890abcdef1234567890abcdef12345678' }),
    );
    const addr = await rpc.getBridgehubAddress();
    expect(addr).toBe('0x1234567890abcdef1234567890abcdef12345678');
  });

  it('wraps unexpected response shape into ZKsyncError', () => {
    const rpc = createZksRpc(fakeTransport({ zks_getBridgehubContract: 42 }));
    return expect(rpc.getBridgehubAddress()).rejects.toThrow(
      /Unexpected Bridgehub address response/,
    );
  });
});

describe('rpc/zks.getL2ToL1LogProof', () => {
  it('returns normalized proof on success', async () => {
    const proof = {
      index: '5',
      batchNumber: '10',
      proof: [('0x' + '11'.repeat(32)) as `0x${string}`],
    };
    const rpc = createZksRpc(fakeTransport({ zks_getL2ToL1LogProof: () => proof }));
    const out = await rpc.getL2ToL1LogProof(('0x' + 'aa'.repeat(32)) as `0x${string}`, 0);
    expect(out).toEqual({ id: 5n, batchNumber: 10n, proof: proof.proof });
  });

  it('throws STATE error when proof is unavailable (null/undefined/falsey)', () => {
    const rpc = createZksRpc(fakeTransport({ zks_getL2ToL1LogProof: null }));
    return expect(
      rpc.getL2ToL1LogProof(('0x' + 'bb'.repeat(32)) as `0x${string}`, 1),
    ).rejects.toThrow(/Proof not yet available/);
  });
});

describe('rpc/zks.getReceiptWithL2ToL1', () => {
  it('returns null when RPC returns null', async () => {
    const rpc = createZksRpc(fakeTransport({ eth_getTransactionReceipt: null }));
    const rcpt = await rpc.getReceiptWithL2ToL1(('0x' + 'cc'.repeat(32)) as `0x${string}`);
    expect(rcpt).toBeNull();
  });

  it('ensures l2ToL1Logs is an array even if missing or malformed', async () => {
    const base = { transactionHash: '0x' + 'dd'.repeat(32), status: 1 };
    const rpc1 = createZksRpc(fakeTransport({ eth_getTransactionReceipt: { ...base } }));
    const out1 = await rpc1.getReceiptWithL2ToL1(('0x' + 'dd'.repeat(32)) as `0x${string}`);
    expect(out1?.l2ToL1Logs).toEqual([]);

    const rpc2 = createZksRpc(
      fakeTransport({ eth_getTransactionReceipt: { ...base, l2ToL1Logs: 'not-an-array' } }),
    );
    const out2 = await rpc2.getReceiptWithL2ToL1(('0x' + 'ee'.repeat(32)) as `0x${string}`);
    expect(out2?.l2ToL1Logs).toEqual([]);

    const logs = [
      {
        l2_shard_id: 0,
        is_service: false,
        tx_number_in_block: 1,
        sender: '0x0' as any,
        key: '0x1' as any,
        value: '0x2' as any,
      },
    ];
    const rpc3 = createZksRpc(
      fakeTransport({ eth_getTransactionReceipt: { ...base, l2ToL1Logs: logs } }),
    );
    const out3 = await rpc3.getReceiptWithL2ToL1(('0x' + 'ff'.repeat(32)) as `0x${string}`);
    expect(out3?.l2ToL1Logs).toEqual(logs);
  });
});
