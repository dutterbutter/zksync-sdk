// src/types/withdrawals.ts
import type { TransactionRequest } from 'ethers';
import type { Address, Hex, UInt } from './primitives';

/** Input for all withdrawal flows. Route selection is adapter-side (ETH vs ERC-20). */
export interface WithdrawParams {
  /** L2 token to withdraw (ETH sentinel or L2 ERC-20 address). */
  token: Address;
  /** Amount to withdraw (token’s smallest unit). */
  amount: UInt;

  /** L1 recipient. Defaults to caller if omitted (adapter decides). */
  to?: Address;

  /** Optional gas hint for L2 tx; adapter may ignore/override. */
  l2GasLimit?: UInt;
}

/** Normalized route label (purely informational; adapters compute this). */
export type WithdrawRoute = 'eth' | 'erc20';

/** Minimal approval requirement record (on L2). */
export interface L2ApprovalNeed {
  /** The L2 token needing approval. */
  token: Address;
  /** The L2 spender (e.g., asset handler / NTV). */
  spender: Address;
  /** Allowance amount required. */
  amount: UInt;
}

/** What the app learns from quote() before building/sending txs. */
export interface WithdrawQuote {
  route: WithdrawRoute;

  /** L2 approvals the caller must satisfy before create()/prepare(). */
  approvalsNeeded: readonly L2ApprovalNeed[];

  /** Gas guidance actually used by the quote for L2. */
  suggestedL2GasLimit: UInt;

  /** Disclose safety knobs applied by the adapter/registry. */
  minGasLimitApplied: boolean;
  gasBufferPctApplied: number;
}

/** Step kinds for the withdrawal flow. */
export type WithdrawPlanStepKind =
  | 'approve:l2' // ERC-20 approval on L2
  | 'l2-asset-router:withdraw' // call L2AssetRouter.withdraw(...)
  | 'l1-nullifier:finalize'; // optional: finalize on L1 (new format)

/** A single executable step in the plan. */
export interface WithdrawPlanStep {
  key: string; // e.g., "approve:l2:<token>:<spender>"
  kind: WithdrawPlanStepKind;
  description: string; // human-friendly
  canSkip: boolean; // computed during prepare (e.g., allowance sufficient)
  tx: TransactionRequest; // fully formed unsigned tx
}

/** Prepared plan for executing the withdrawal. */
export interface WithdrawPlan {
  route: WithdrawRoute;
  summary: WithdrawQuote;
  steps: WithdrawPlanStep[]; // order matters
}

/** Minimal handle we return from create(). */
export interface WithdrawHandle {
  kind: 'withdrawal';

  /** The submitted L2 withdrawal tx hash (always present after create). */
  l2TxHash: Hex;

  /** The submitted L1 finalize tx hash (present only if finalize step executed). */
  l1TxHash?: Hex;

  /** Optional proof indices discovered during wait/proof gathering. */
  l2BatchNumber?: number;
  l2MessageIndex?: number;
  l2TxNumberInBatch?: number;

  /** Step key -> tx hash map for all executed steps. */
  stepHashes: Record<string, Hex>;

  /** The plan used to create the withdrawal. */
  plan: WithdrawPlan;
}

/** Inputs that wait() should accept. */
export type WithdrawalWaitable = Hex | { l2TxHash?: Hex; l1TxHash?: Hex } | WithdrawHandle;
