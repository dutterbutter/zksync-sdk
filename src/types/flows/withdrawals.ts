// src/types/flows/withdrawals.ts
import type { Address, Hex, UInt } from '../primitives';
import type { ApprovalNeed, Plan, PlanStep, Handle } from './base';

/** Input */
export interface WithdrawParams {
  token: Address; // ETH sentinel or L2 ERC20
  amount: UInt;
  to?: Address; // L1 receiver
  l2GasLimit?: UInt;
}

/** Routes */
export type WithdrawRoute = 'eth' | 'erc20';

/** Quote */
export interface WithdrawQuote {
  route: WithdrawRoute;
  approvalsNeeded: readonly ApprovalNeed[]; // L2 approvals
  suggestedL2GasLimit: UInt;
  minGasLimitApplied: boolean;
  gasBufferPctApplied: number;
}

/** Step kinds */
export type WithdrawPlanStepKind = 'approve:l2' | 'l2:withdraw' | 'l1:nullifier:finalize';

/** Step (Tx generic) */
export type WithdrawPlanStep<Tx> = PlanStep<Tx> & { kind: WithdrawPlanStepKind };

/** Plan (Tx generic) */
export type WithdrawPlan<Tx> = Plan<Tx, WithdrawRoute, WithdrawQuote>;

/** Handle */
export interface WithdrawHandle<Tx>
  extends Handle<Record<string, Hex>, WithdrawRoute, WithdrawPlan<Tx>> {
  kind: 'withdrawal';
  l2TxHash: Hex;
  l1TxHash?: Hex;
  l2BatchNumber?: number;
  l2MessageIndex?: number;
  l2TxNumberInBatch?: number;
}

/** Waitable */
export type WithdrawalWaitable = Hex | { l2TxHash?: Hex; l1TxHash?: Hex } | WithdrawHandle<unknown>;

type WaitTarget = 'l2' | 'l1' | 'finalized';

export interface WaitOpts {
  for: WaitTarget; // what are we waiting on?
}

export interface FinalizeDepositParams {
  chainId: bigint;
  l2BatchNumber: bigint;
  l2MessageIndex: bigint;
  l2Sender: Address;
  l2TxNumberInBatch: number;
  message: Hex;
  merkleProof: Hex[];
}

export type WithdrawalKey = {
  chainIdL2: bigint; // your L2 chain id
  l2BatchNumber: bigint; // from proof info / rpc
  l2MessageIndex: bigint; // from proof info / rpc
};

export type FinalizedTriState = 'unknown' | 'pending' | 'finalized';

export class WithdrawalNotReady extends Error {
  constructor(message = 'Withdrawal not ready for finalization.') {
    super(message);
    this.name = 'WithdrawalNotReady';
  }
}
