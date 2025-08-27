import type { Address, Hex, UInt } from '../primitives';

export type BundleItem =
  | { kind: 'native'; to: Address; amount: UInt }
  | { kind: 'erc20'; token: Address; to: Address; amount: UInt }
  | { kind: 'call'; to: Address; data: Hex; value?: UInt };

export type BundleInput = {
  dstChainId: bigint;
  items: ReadonlyArray<BundleItem>;
  l2GasLimit?: UInt;
  gasPerPubdata?: UInt;
};

export type BundleQuote = {
  approvalsNeeded: ReadonlyArray<{ token: Address; spender: Address; amount: UInt }>;
  baseCost: UInt;
  suggestedL2GasLimit: UInt;
  gasPerPubdata: UInt;
  /** Optional planner-side limit checks */
  tooLarge?: boolean;
  maxItems?: number;
};

export type BundlePlan = {
  preTxs: ReadonlyArray<{ to: Address; data: Hex; value?: UInt }>;
  bundleTx: { to: Address; data: Hex; value?: UInt };
};
