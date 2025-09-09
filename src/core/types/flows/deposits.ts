// src/types/flows/deposits.ts
import type { Address, Hex, UInt } from '../primitives';
import type { ApprovalNeed, Plan, Handle } from './base';

/** Input */
export interface DepositParams {
  token: Address;
  amount: UInt;
  to?: Address;
  refundRecipient?: Address;
  l2GasLimit?: UInt;
  gasPerPubdata?: UInt;
  operatorTip?: UInt;
}

/** Routes */
export type DepositRoute = 'eth' | 'erc20-base' | 'erc20-nonbase';

/** Quote */
export interface DepositQuote {
  route: DepositRoute;
  approvalsNeeded: readonly ApprovalNeed[];
  baseCost: UInt;
  mintValue: UInt;
  suggestedL2GasLimit: UInt;
  gasPerPubdata: UInt;
  minGasLimitApplied: boolean;
  gasBufferPctApplied: number;
}

// /** Plan step kinds */
// export type DepositPlanStepKind = 'approve' | 'bridgehub:direct' | 'bridgehub:two-bridges';

// /** Adapter-agnostic step (Tx generic) */
// export type DepositPlanStep<Tx> = PlanStep<Tx> & { kind: DepositPlanStepKind };

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
