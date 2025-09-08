// src/types/flows/base.ts
import type { Address, Hex, UInt } from '../primitives';

/** Generic approval requirement */
export interface ApprovalNeed {
  token: Address;
  spender: Address;
  amount: UInt;
}

/** Generic step (adapter injects Tx type) */
export interface PlanStep<Tx> {
  key: string;
  kind: string; // route-specific discriminator
  description: string;
  canSkip: boolean;
  tx: Tx; // adapter-specific tx (e.g., ethers TransactionRequest)
}

/** Generic plan */
export interface Plan<Tx, Route, Quote> {
  route: Route;
  summary: Quote;
  steps: Array<PlanStep<Tx>>;
}

/** Generic handle (returned by create()) */
export interface Handle<TxHashMap extends Record<string, Hex>, Route, PlanT> {
  kind: 'deposit' | 'withdrawal';
  route?: Route;
  stepHashes: TxHashMap; // step key -> tx hash
  plan: PlanT;
}

/** Waitable inputs */
export type Waitable<HashKey extends string = 'txHash'> =
  | Hex
  | Record<HashKey, Hex>
  | { [k in HashKey]?: Hex } // allows L1 or L2 forms
  | { stepHashes?: Record<string, Hex> };

export interface CommonCtx {
  sender: Address;
  chainIdL2: bigint;
  bridgehub: Address;
}
