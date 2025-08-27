import type { Address, Hex } from '../types/primitives';

export interface ReadProvider {
  call(args: { to: Address; data: Hex }): Promise<Hex>;
  getLogs(args: {
    address?: Address;
    topics?: (Hex | null)[];
    fromBlock?: bigint;
    toBlock?: bigint;
  }): Promise<readonly { topics: readonly Hex[]; data: Hex }[]>;
  getBlockNumber(): Promise<bigint>;
  getTxReceipt(
    hash: Hex,
  ): Promise<{ status: 'success' | 'reverted' | 'pending'; logs: unknown[] } | null>;
}

export type BackoffConfig = {
  base?: number; // ms
  factor?: number; // multiplier
  jitter?: number; // 0..1, % of variance
  cap?: number; // max delay in ms
};
