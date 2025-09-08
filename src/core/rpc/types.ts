import type { Hex } from "../types/primitives";

export type AddressHex = `0x${string}`;

export type L2ToL1Log = {
  l2_shard_id: number;
  is_service: boolean;
  tx_number_in_block: number;
  sender: AddressHex;
  key: Hex;                
  value: Hex;
};

export type ReceiptWithL2ToL1 = {
  transactionHash?: Hex;
  status?: string | number;
  blockNumber?: string | number;
  logs?: Array<{
    address: AddressHex;
    topics: Hex[];
    data: Hex;
  }>;
  // ZKsync-specific field
  l2ToL1Logs?: L2ToL1Log[];
};

export type ProofNormalized = {
  id: bigint;
  batchNumber: bigint;
  proof: Hex[];
};
