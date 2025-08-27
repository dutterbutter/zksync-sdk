import type { Address, Hex, UInt } from '../primitives';

export type RemoteCallParams = {
  dstChainId: bigint;
  to: Address;
  data: Hex;
  value?: UInt; // value to forward on destination
  l2GasLimit?: UInt;
  gasPerPubdata?: UInt;
};

export type RemoteQuote = {
  baseCost: UInt;
  suggestedL2GasLimit: UInt;
  gasPerPubdata: UInt;
};

export type RemotePlan = {
  preTxs: ReadonlyArray<{ to: Address; data: Hex; value?: UInt }>;
  callTx: { to: Address; data: Hex; value?: UInt };
};
