// src/adapters/ethers/resources/withdrawals/routes/types.ts
import type { TransactionRequest, TransactionReceipt } from 'ethers';
import type { WithdrawParams } from '../../../../../types/flows/withdrawals';
import type { RouteStrategy } from '../../../../../types/flows/route';
import type { BuildCtx as WithdrawBuildCtx } from '../context';
import { Address, Hex } from '../../../../../types';

// No special extras today, but keep extensible
export type WithdrawQuoteExtras = Record<string, never>;

export type WithdrawRouteStrategy = RouteStrategy<
  WithdrawParams,
  TransactionRequest,
  WithdrawQuoteExtras,
  WithdrawBuildCtx
>;

// L2→L1 service log (JS-friendly/camelCase)
export interface L2ToL1Log {
  l2ShardId: number; // from "l2_shard_id"
  isService: boolean; // from "is_service"
  txNumberInBlock: number; // from "tx_number_in_block"
  sender: Address;
  key: Hex;
  value: Hex;
}

// If you want to keep the raw (snake_case) form too:
export interface RawL2ToL1Log {
  l2_shard_id: number;
  is_service: boolean;
  tx_number_in_block: number;
  sender: Address;
  key: Hex;
  value: Hex;
}

// Ethers receipt extended with optional L2→L1 logs
export type TransactionReceiptZKsyncOS = TransactionReceipt & {
  l2ToL1Logs?: L2ToL1Log[] | RawL2ToL1Log[];
};
