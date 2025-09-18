// src/adapters/viem/resources/withdrawals/context.ts

import type { ViemClient } from '../../client';
import type { Address } from '../../../../core/types/primitives';
import { pickWithdrawRoute } from '../../../../core/resources/withdrawals/route';
import type { WithdrawParams, WithdrawRoute } from '../../../../core/types/flows/withdrawals';
import type { CommonCtx } from '../../../../core/types/flows/base';

/** Optional 1559 fee overrides for L2 writes (viem shape). */
export type ViemFeeOverrides = {
  /** Prefer 1559; leave undefined to let wallet/provider fill. */
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
};

// Common context for building withdrawal (L2 -> L1) transactions (viem)
export interface BuildCtx extends CommonCtx {
  client: ViemClient;

  // L1 + L2 well-knowns
  bridgehub: Address;
  l1AssetRouter: Address;
  l1Nullifier: Address;
  l2AssetRouter: Address;
  l2NativeTokenVault: Address;
  l2BaseTokenSystem: Address;

  // L2 chain + sender
  chainIdL2: bigint;
  sender: Address;

  // L2 gas knobs for the withdraw tx
  l2GasLimit: bigint;   // default 300_000n
  gasBufferPct: number; // default 15 (%)

  // Optional fee overrides for L2 send (viem 1559 fields)
  fee?: ViemFeeOverrides;
}

export async function commonCtx(
  p: WithdrawParams,
  client: ViemClient,
): Promise<BuildCtx & { route: WithdrawRoute }> {
  const sender = client.account.address;

  const {
    bridgehub,
    l1AssetRouter,
    l1Nullifier,
    l2AssetRouter,
    l2NativeTokenVault,
    l2BaseTokenSystem,
  } = await client.ensureAddresses();

  const chainIdL2 = BigInt(await client.l2.getChainId());

  // Route: 'eth' | 'erc20'
  const route = pickWithdrawRoute(p.token);

  // Basic defaults; can be overridden per route if needed
  const l2GasLimit = p.l2GasLimit ?? 300_000n;
  const gasBufferPct = 15;

  return {
    client,
    bridgehub,
    chainIdL2,
    sender,
    route,
    l1AssetRouter,
    l1Nullifier,
    l2AssetRouter,
    l2NativeTokenVault,
    l2BaseTokenSystem,
    l2GasLimit,
    gasBufferPct,
    // fee?: you can thread in user-provided overrides later if you introduce them in WithdrawParams
  } satisfies BuildCtx & { route: WithdrawRoute };
}
