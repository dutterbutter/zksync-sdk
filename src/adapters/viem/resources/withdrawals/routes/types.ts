// src/adapters/viem/resources/withdrawals/routes/types.ts

import type { WalletClient, Transport, Chain, Account, TransactionReceipt } from 'viem';
import type { WithdrawParams } from '../../../../../core/types/flows/withdrawals';
import type { RouteStrategy } from '../../../../../core/types/flows/route';
import type { BuildCtx as WithdrawBuildCtx } from '../context';
import type { Address, Hex } from '../../../../../core/types';

// viem writeContract() parameter type (same approach as deposits)
export type ViemPlanWriteRequest = Parameters<
  WalletClient<Transport, Chain, Account>['writeContract']
>[0];

export type WithdrawQuoteExtras = Record<string, never>;

export type WithdrawRouteStrategy = RouteStrategy<
  WithdrawParams,
  ViemPlanWriteRequest,
  WithdrawQuoteExtras,
  WithdrawBuildCtx
>;

// ---- zkSync-specific L2->L1 log (kept identical to ethers version) ----
export interface L2ToL1Log {
  l2ShardId?: number;
  isService?: boolean;
  txNumberInBlock?: number;
  sender?: Address;
  key?: Hex;
  value?: Hex;
}

// viem receipt extended with L2->L1 logs (same surface as ethers variant)
export type TransactionReceiptZKsyncOS = TransactionReceipt & {
  l2ToL1Logs?: L2ToL1Log[];
};
