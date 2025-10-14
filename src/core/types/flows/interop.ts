// src/types/flows/interop.ts
import type { Address, Hex } from '../primitives';
import type { ApprovalNeed, Plan, Handle } from './base';

/** === Inputs === */

export type InteropAction =
  | { type: 'sendNative'; to: Address; amount: bigint }
  | { type: 'sendErc20'; token: Address; to: Address; amount: bigint }
  | { type: 'call'; to: Address; data: Hex; value?: bigint };

export interface InteropParams {
  /** Optional; defaults to connected wallet */
  sender?: Address;
  /** Destination chain (eip155 id) */
  dst: bigint;
  /** Optional execution guard (bundle-level) */
  execution?: { only: Address };
  /** Optional unbundling authority (bundle-level) */
  unbundling?: { by: Address };
  /** The actions to perform on the destination chain */
  actions: readonly InteropAction[];
}

/** === Routing ===
 * 'direct'  → burn/mint value (native/base) when chains share the same base token
 * 'router'  → route value via asset router / bridge (erc20s or base mismatch)
 */
export type InteropRoute = 'direct' | 'router';

/** === Quote === */
export interface InteropQuote {
  route: InteropRoute;
  approvalsNeeded: readonly ApprovalNeed[];

  /** Value semantics */
  totalActionValue: bigint; // sum of msg.value across actions (sendNative + call.value)
  bridgedTokenTotal: bigint; // sum of ERC-20 amounts to bridge (normalized total)
  // Fees (keep generic; adapters can refine/override)
  l1Fee?: bigint;
  l2Fee?: bigint;
}

/** === Plan (Tx generic) === */
export type InteropPlan<Tx> = Plan<Tx, InteropRoute, InteropQuote>;

/** === Handle (returned by create) === */
export interface InteropHandle<Tx>
  extends Handle<Record<string, Hex>, InteropRoute, InteropPlan<Tx>> {
  kind: 'interop';
  /** Source L2 tx that emitted InteropBundleSent */
  l2SrcTxHash: Hex;
  /** L2->L1 message hash (from the messenger) if surfaced by the adapter */
  l1MsgHash?: Hex;
  /** Bundle hash (destination-unique id) if surfaced by the adapter */
  bundleHash?: Hex;
  /** Destination chain id (eip155) */
  dstChainId?: bigint;
  /** Destination execution tx hash (if/once known) */
  dstExecTxHash?: Hex;
}

/** === Waitable === */
export type InteropWaitable =
  | Hex
  | { l2SrcTxHash?: Hex; l1MsgHash?: Hex; bundleHash?: Hex; dstExecTxHash?: Hex }
  | InteropHandle<unknown>;

/** === Status & phases === */
export type InteropPhase =
  | 'SENT' // InteropBundleSent observed on source
  | 'VERIFIED' // bundle verified on destination
  | 'EXECUTED' // fully executed atomically
  | 'UNBUNDLED' // selectively executed/cancelled
  | 'FAILED'
  | 'UNKNOWN';

export interface InteropStatus {
  phase: InteropPhase;
  l2SrcTxHash?: Hex;
  l1MsgHash?: Hex;
  bundleHash?: Hex;
  dstExecTxHash?: Hex;
}

/** === Minimal receipt/log shapes used by core (adapter can adapt) === */
