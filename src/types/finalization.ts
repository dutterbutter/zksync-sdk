export type FinalityTarget = 'l1' | 'l2' | 'finalized';

export type FinalityState =
  | { state: 'pending' }
  | { state: 'l1'; blockNumber?: bigint }
  | { state: 'l2'; blockNumber?: bigint }
  | { state: 'finalized'; blockNumber?: bigint };

export type WaitResult = FinalityState & { txHash: `0x${string}` };
