// src/types/flows/deposits.ts
import type { Address, Hex } from '../primitives';
import type { ApprovalNeed, Plan, Handle } from './base';

/** Input */
export interface DepositParams {
  token: Address;
  amount: bigint;
  to?: Address;
  refundRecipient?: Address;
  l2GasLimit?: bigint;
  gasPerPubdata?: bigint;
  operatorTip?: bigint;
}

/** Routes */
export type DepositRoute = 'eth-base' | 'eth-nonbase' | 'erc20-base' | 'erc20-nonbase';
// | 'erc20-base'  // uncomment when supported

/** Quote */
export interface DepositQuote {
  route: DepositRoute;
  approvalsNeeded: readonly ApprovalNeed[];
  baseCost: bigint;
  mintValue: bigint;
  suggestedL2GasLimit: bigint;
  gasPerPubdata: bigint;
}

/** Plan (Tx generic) */
export type DepositPlan<Tx> = Plan<Tx, DepositRoute, DepositQuote>;

/** Handle */
export interface DepositHandle<Tx>
  extends Handle<Record<string, Hex>, DepositRoute, DepositPlan<Tx>> {
  kind: 'deposit';
  l1TxHash: Hex;
  l2ChainId?: number;
  l2TxHash?: Hex;
}

/** Waitable */
export type DepositWaitable = Hex | { l1TxHash: Hex } | DepositHandle<unknown>;

// Status and phases
export type DepositPhase =
  | 'L1_PENDING'
  | 'L1_INCLUDED' // L1 included, L2 hash not derived yet
  | 'L2_PENDING' // we have L2 hash, but no receipt yet
  | 'L2_EXECUTED' // L2 receipt.status === 1
  | 'L2_FAILED' // L2 receipt.status === 0
  | 'UNKNOWN';

// Deposit Status
export type DepositStatus = {
  phase: DepositPhase;
  l1TxHash: Hex;
  l2TxHash?: Hex;
};
