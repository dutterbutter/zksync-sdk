// src/adapters/viem/resources/withdrawals/context.ts

import type { ViemClient } from '../../client';
import type { Address } from '../../../../core/types/primitives';
import { pickWithdrawRoute } from '../../../../core/resources/withdrawals/route';
import type { WithdrawParams, WithdrawRoute } from '../../../../core/types/flows/withdrawals';
import type { CommonCtx } from '../../../../core/types/flows/base';
import { isEthBasedChain } from '../token-info';

// TODO: move all fee and gas items to dedicated resource?
export type ViemFeeOverrides = {
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
};

// Common context for building withdrawal (L2 -> L1) transactions
export interface BuildCtx extends CommonCtx {
  client: ViemClient;

  // L1 + L2 well-knowns
  bridgehub: Address;
  l1AssetRouter: Address;
  l1Nullifier: Address;
  l2AssetRouter: Address;
  l2NativeTokenVault: Address;
  l2BaseTokenSystem: Address;
  // Base token info
  baseIsEth: boolean;

  // L2 chain + sender
  chainIdL2: bigint;
  sender: Address;

  // L2 gas
  l2GasLimit: bigint;
  gasBufferPct: number;

  // Optional fee overrides for L2 send
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
  const baseIsEth = await isEthBasedChain(client.l2, l2NativeTokenVault);

  // route selection
  const route = pickWithdrawRoute({
    token: p.token,
    baseIsEth,
  });

  // TODO: improve gas estimations
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
    baseIsEth,
    l2GasLimit,
    gasBufferPct,
  } satisfies BuildCtx & { route: WithdrawRoute };
}
