import type { Address, UInt } from '../primitives';

export type SendNativeParams = {
  to: Address; // target L2 address
  amount: UInt;
  dstChainId: bigint;
  l2GasLimit?: UInt;
  gasPerPubdata?: UInt;
};

export type SendERC20Params = SendNativeParams & {
  token: Address; // ERC-20 on source chain
};

export type TransferQuote = {
  route: 'native' | 'erc20';
  approvalsNeeded: ReadonlyArray<{ token: Address; spender: Address; amount: UInt }>;
  baseCost: UInt;
  suggestedL2GasLimit: UInt;
  gasPerPubdata: UInt;
};

export type TransferPlan = {
  preTxs: ReadonlyArray<{ to: Address; data: `0x${string}`; value?: UInt }>;
  sendTx: { to: Address; data: `0x${string}`; value?: UInt };
};
