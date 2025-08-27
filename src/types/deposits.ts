// src/types/deposit.ts
import type { TransactionRequest } from 'ethers';
import type { Address, Hex, UInt } from './primitives';

/** Input for all deposit flows. Route selection is adapter-side. */
export interface DepositParams {
  /** Token to bridge. Use canonical ETH sentinel if you want (adapters can normalize). */
  token: Address;
  /** Amount to deposit (in token’s smallest unit). */
  amount: UInt;

  /** L2 recipient (defaults to sender if omitted). */
  to?: Address;
  /** L2 refund recipient for unused gas / failed exec (defaults per adapter). */
  refundRecipient?: Address;

  /** Optional L2 execution hints (adapters can estimate / override). */
  l2GasLimit?: UInt;
  gasPerPubdata?: UInt;

  operatorTip?: UInt;
}

// TODO: determine if this is a good approach for route identification
/** Normalized route label (purely informational; adapters compute this). */
export type DepositRoute =
  | 'eth' // deposit ETH when base token is ETH
  | 'erc20-base' // deposit base token on a non-ETH-based chain
  | 'erc20-nonbase'; // deposit non-base ERC20

/** Minimal approval requirement record. */
interface ApprovalNeed {
  token: Address;
  spender: Address;
  amount: UInt;
}

/** What the app learns from quote() before building/sending txs. */
export interface DepositQuote {
  route: DepositRoute;

  /** Approvals the caller must satisfy before create()/prepare(). */
  approvalsNeeded: readonly ApprovalNeed[];

  /** L1 base cost in wei (if relevant to the route), else 0n. */
  baseCost: UInt;
  mintValue: UInt;

  /** Gas guidance actually used by the quote. */
  suggestedL2GasLimit: UInt;
  gasPerPubdata: UInt;

  /** Disclose safety knobs applied by the adapter/registry. */
  minGasLimitApplied: boolean;
  gasBufferPctApplied: number;
}

/** Minimal handle we return from create(). */
export interface DepositHandle {
  /** The submitted L1 tx hash. */
  l1TxHash: Hex;
  /** Optionally surface the target L2 chain id (if known). */
  l2ChainId?: number;
  /** Optionally surface the canonical L2 tx hash (if/when known). */
  l2TxHash?: Hex;
  // Todo: thnk
  stepHashes: Record<string, Hex>; // key -> tx hash
  plan: DepositPlan;
}

/** Inputs that wait() should accept. */
export type DepositWaitable = Hex | { l1TxHash: Hex } | DepositHandle;

export type PlanStepKind = 'approve' | 'bridgehub:direct' | 'bridgehub:two-bridges';

export interface PlanStep {
  key: string; // e.g., "approve:token:router"
  kind: PlanStepKind;
  description: string; // human-friendly
  canSkip: boolean; // computed during prepare (e.g., allowance sufficient)
  tx: TransactionRequest; // fully formed unsigned tx
}

export interface DepositPlan {
  route: DepositRoute;
  summary: DepositQuote;
  steps: PlanStep[]; // order matters
}
