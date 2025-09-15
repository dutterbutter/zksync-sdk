/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { RpcTransport } from './types';
import type { AddressHex, ReceiptWithL2ToL1, ProofNormalized } from './types';
import type { Hex } from '../types/primitives';
import { createError, shapeCause } from '../errors/factory';
import { RESOURCE, withRpcOp } from '../errors/rpc';
import { isZKsyncError } from '../types/errors';

export interface ZksRpc {
  getBridgehubAddress(): Promise<AddressHex>;
  getL2ToL1LogProof(txHash: Hex, index: number): Promise<ProofNormalized>;
  getReceiptWithL2ToL1(txHash: Hex): Promise<ReceiptWithL2ToL1 | null>;
}

const METHODS = {
  getBridgehub: 'zks_getBridgehubContract',
  getL2ToL1LogProof: 'zks_getL2ToL1LogProof',
  getReceipt: 'eth_getTransactionReceipt',
} as const;

// TODO: move to utils
function toHexArray(arr: any): Hex[] {
  return (Array.isArray(arr) ? arr : []).map((x) => x as Hex);
}

// TODO: better validation
export function normalizeProof(p: any): ProofNormalized {
  try {
    const idRaw = p?.id ?? p?.index;
    const bnRaw = p?.batch_number ?? p?.batchNumber;
    if (idRaw == null || bnRaw == null) {
      throw createError('RPC', {
        resource: RESOURCE,
        operation: 'zksrpc.normalizeProof',
        message: 'Malformed proof: missing id or batch number.',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        context: { keys: Object.keys(p ?? {}) },
      });
    }

    const toBig = (x: any) =>
      typeof x === 'bigint'
        ? x
        : typeof x === 'number'
        ? BigInt(x)
        : typeof x === 'string'
        ? BigInt(x)
        : (() => {
            throw createError('RPC', {
              resource: RESOURCE,
              operation: 'zksrpc.normalizeProof',
              message: 'Malformed proof: invalid numeric field.',
              context: { valueType: typeof x },
            });
          })();

    return {
      id: toBig(idRaw),
      batchNumber: toBig(bnRaw),
      proof: toHexArray(p?.proof),
    };
  } catch (e) {
    if (isZKsyncError(e)) throw e;
    throw createError('RPC', {
      resource: RESOURCE,
      operation: 'zksrpc.normalizeProof',
      message: 'Failed to normalize proof.',
      context: { receivedType: typeof p },
      cause: shapeCause(e),
    });
  }
}

export function createZksRpc(transport: RpcTransport): ZksRpc {
  return {
    async getBridgehubAddress() {
      return withRpcOp(
        'zksrpc.getBridgehubAddress',
        'Failed to fetch Bridgehub address.',
        {},
        async () => {
          const addr = await transport(METHODS.getBridgehub, []);
          // Validate response shape
          if (typeof addr !== 'string' || !addr.startsWith('0x')) {
            throw createError('RPC', {
              resource: RESOURCE,
              operation: 'zksrpc.getBridgehubAddress',
              message: 'Unexpected Bridgehub address response.',
              context: { valueType: typeof addr },
            });
          }
          return addr as AddressHex;
        },
      );
    },

    async getL2ToL1LogProof(txHash, index) {
      return withRpcOp(
        'zksrpc.getL2ToL1LogProof',
        'Failed to fetch L2→L1 log proof.',
        { txHash, index },
        async () => {
          const proof = await transport(METHODS.getL2ToL1LogProof, [txHash, index]);
          if (!proof) {
            // proof missing is a normal “unavailable yet” state from node → classify as STATE
            throw createError('STATE', {
              resource: RESOURCE,
              operation: 'zksrpc.getL2ToL1LogProof',
              message: 'Proof not yet available. Please try again later.',
              context: { txHash, index },
            });
          }
          return normalizeProof(proof);
        },
      );
    },

    async getReceiptWithL2ToL1(txHash) {
      return withRpcOp(
        'zksrpc.getReceiptWithL2ToL1',
        'Failed to fetch transaction receipt.',
        { txHash },
        async () => {
          const rcpt = await transport(METHODS.getReceipt, [txHash]);
          if (!rcpt) return null;
          rcpt.l2ToL1Logs = Array.isArray(rcpt.l2ToL1Logs) ? rcpt.l2ToL1Logs : [];
          return rcpt as ReceiptWithL2ToL1;
        },
      );
    },
  };
}
