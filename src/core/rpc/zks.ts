// src/core/rpc/zks.ts

import type { RpcTransport } from './types';
import type { ReceiptWithL2ToL1, ProofNormalized } from './types';
import type { Hex, Address } from '../types/primitives';
import { createError, shapeCause } from '../errors/factory';
import { withRpcOp } from '../errors/rpc';
import { isZKsyncError, type Resource } from '../types/errors';

/** ZKsync-specific RPC methods. */
export interface ZksRpc {
  // Fetches the Bridgehub contract address.
  getBridgehubAddress(): Promise<Address>;

  // Fetches a proof for an L2→L1 log emitted in the given transaction.
  getL2ToL1LogProof(txHash: Hex, index: number): Promise<ProofNormalized>;

  // Fetches the transaction receipt, including the `l2ToL1Logs` field.
  getReceiptWithL2ToL1(txHash: Hex): Promise<ReceiptWithL2ToL1 | null>;
}

const METHODS = {
  getBridgehub: 'zks_getBridgehubContract',
  getL2ToL1LogProof: 'zks_getL2ToL1LogProof',
  getReceipt: 'eth_getTransactionReceipt',
} as const;

// TODO: move to utils
function toHexArray(arr: unknown): Hex[] {
  const list = Array.isArray(arr) ? (arr as unknown[]) : [];
  return list.map((x) => x as Hex);
}

// TODO: better validation
// normalize proof response into consistent shape
export function normalizeProof(p: unknown): ProofNormalized {
  try {
    const raw = (p ?? {}) as Record<string, unknown>;
    const idRaw = raw?.id ?? raw?.index;
    const bnRaw = raw?.batch_number ?? raw?.batchNumber;
    if (idRaw == null || bnRaw == null) {
      throw createError('RPC', {
        resource: 'zksrpc' as Resource,
        operation: 'zksrpc.normalizeProof',
        message: 'Malformed proof: missing id or batch number.',

        context: { keys: Object.keys(raw ?? {}) },
      });
    }

    const toBig = (x: unknown) =>
      typeof x === 'bigint'
        ? x
        : typeof x === 'number'
          ? BigInt(x)
          : typeof x === 'string'
            ? BigInt(x)
            : (() => {
                throw createError('RPC', {
                  resource: 'zksrpc' as Resource,
                  operation: 'zksrpc.normalizeProof',
                  message: 'Malformed proof: invalid numeric field.',
                  context: { valueType: typeof x },
                });
              })();

    return {
      id: toBig(idRaw),
      batchNumber: toBig(bnRaw),
      proof: toHexArray(raw?.proof),
    };
  } catch (e) {
    if (isZKsyncError(e)) throw e;
    throw createError('RPC', {
      resource: 'zksrpc' as Resource,
      operation: 'zksrpc.normalizeProof',
      message: 'Failed to normalize proof.',
      context: { receivedType: typeof p },
      cause: shapeCause(e),
    });
  }
}

// Constructs a ZksRpc instance using the given transport function.
export function createZksRpc(transport: RpcTransport): ZksRpc {
  return {
    // Fetches the Bridgehub contract address.
    async getBridgehubAddress() {
      return withRpcOp(
        'zksrpc.getBridgehubAddress',
        'Failed to fetch Bridgehub address.',
        {},
        async () => {
          const addrRaw = (await transport(METHODS.getBridgehub, [])) as unknown;
          // Validate response shape
          if (typeof addrRaw !== 'string' || !addrRaw.startsWith('0x')) {
            throw createError('RPC', {
              resource: 'zksrpc' as Resource,
              operation: 'zksrpc.getBridgehubAddress',
              message: 'Unexpected Bridgehub address response.',
              context: { valueType: typeof addrRaw },
            });
          }
          return addrRaw as Address;
        },
      );
    },

    // Fetches a proof for an L2→L1 log emitted in the given transaction.
    async getL2ToL1LogProof(txHash, index) {
      return withRpcOp(
        'zksrpc.getL2ToL1LogProof',
        'Failed to fetch L2→L1 log proof.',
        { txHash, index },
        async () => {
          const proof: unknown = await transport(METHODS.getL2ToL1LogProof, [txHash, index]);
          if (!proof) {
            // proof missing is a normal “unavailable yet” state from node → classify as STATE
            throw createError('STATE', {
              resource: 'zksrpc' as Resource,
              operation: 'zksrpc.getL2ToL1LogProof',
              message: 'Proof not yet available. Please try again later.',
              context: { txHash, index },
            });
          }
          return normalizeProof(proof);
        },
      );
    },

    // Fetches the transaction receipt, including the `l2ToL1Logs` field.
    async getReceiptWithL2ToL1(txHash) {
      return withRpcOp(
        'zksrpc.getReceiptWithL2ToL1',
        'Failed to fetch transaction receipt.',
        { txHash },
        async () => {
          const rcptRaw: unknown = await transport(METHODS.getReceipt, [txHash]);
          if (!rcptRaw) return null;
          const rcptObj = rcptRaw as Record<string, unknown>;
          // ensure l2ToL1Logs is always an array
          const logs = Array.isArray(rcptObj['l2ToL1Logs'])
            ? (rcptObj['l2ToL1Logs'] as unknown[])
            : [];
          rcptObj['l2ToL1Logs'] = logs;
          return rcptObj as ReceiptWithL2ToL1;
        },
      );
    },
  };
}
