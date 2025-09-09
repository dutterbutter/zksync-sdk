/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { RpcTransport } from './types';
import type { AddressHex, ReceiptWithL2ToL1, ProofNormalized } from './types';
import type { Hex } from '../types/primitives';

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

// TODO: move to utils or common
function toHexArray(arr: any): Hex[] {
  return (Array.isArray(arr) ? arr : []).map((x) => x as Hex);
}

// TODO: better validation
export function normalizeProof(p: any): ProofNormalized {
  // id | index
  const idRaw = p?.id ?? p?.index;
  // batch_number | batchNumber
  const bnRaw = p?.batch_number ?? p?.batchNumber;

  if (idRaw == null || bnRaw == null) throw new Error('ProofMalformed');

  const toBig = (x: any) =>
    typeof x === 'bigint'
      ? x
      : typeof x === 'number'
        ? BigInt(x)
        : typeof x === 'string'
          ? BigInt(x)
          : (() => {
              throw new Error('ProofType');
            })();

  return {
    id: toBig(idRaw),
    batchNumber: toBig(bnRaw),
    proof: toHexArray(p?.proof),
  };
}

export function createZksRpc(transport: RpcTransport): ZksRpc {
  return {
    async getBridgehubAddress() {
      const addr = await transport(METHODS.getBridgehub, []);
      // TODO: better validation
      if (typeof addr !== 'string' || !addr.startsWith('0x')) {
        throw new Error('BridgehubUnavailable');
      }
      return addr as AddressHex;
    },

    async getL2ToL1LogProof(txHash, index) {
      const proof = await transport(METHODS.getL2ToL1LogProof, [txHash, index]);
      // TODO: better error envelope
      if (!proof) throw new Error('ProofUnavailable');
      return normalizeProof(proof);
    },

    async getReceiptWithL2ToL1(txHash) {
      const rcpt = await transport(METHODS.getReceipt, [txHash]);
      if (!rcpt) return null;
      rcpt.l2ToL1Logs = Array.isArray(rcpt.l2ToL1Logs) ? rcpt.l2ToL1Logs : [];
      return rcpt as ReceiptWithL2ToL1;
    },
  };
}
