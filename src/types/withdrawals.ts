import type { Address, UInt } from './primitives';

export type WithdrawParams = {
  token: Address; // ETH_SENTINEL or ERC-20 (L2)
  amount: UInt;
  to?: Address; // L1 recipient
};

export type WithdrawQuote = {
  route: 'ETH' | 'ERC20';
  baseCost?: UInt;
};

export type WithdrawPlan = {
  preTxs: ReadonlyArray<{ to: Address; data: `0x${string}`; value?: UInt }>;
  withdrawTx: { to: Address; data: `0x${string}`; value?: UInt };
};
