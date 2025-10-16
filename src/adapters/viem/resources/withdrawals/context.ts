// src/adapters/viem/resources/withdrawals/context.ts

import type { ViemClient } from '../../client';
import type { Address } from '../../../../core/types/primitives';
import { pickWithdrawRoute } from '../../../../core/resources/withdrawals/route';
import type { WithdrawParams, WithdrawRoute } from '../../../../core/types/flows/withdrawals';
import type { CommonCtx } from '../../../../core/types/flows/base';
import { isEthBasedChain } from '../token-info';
import { GasPlanner, DEFAULT_GAS_POLICIES } from '../../../../core/gas';
import type { ViemPlanWriteRequest } from './routes/types';

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
  gas: GasPlanner<ViemPlanWriteRequest>;
}

export async function commonCtx(
  p: WithdrawParams,
  client: ViemClient,
  opts: { allowMissingSender?: boolean } = {},
): Promise<BuildCtx & { route: WithdrawRoute }> {
  const sender = (p.sender ?? client.account?.address) as Address | undefined;
  if (!sender && !opts.allowMissingSender) {
    throw new Error(
      'Withdrawals require a sender account. Provide params.sender or configure the client with an account.',
    );
  }

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

  const gas = new GasPlanner<ViemPlanWriteRequest>(DEFAULT_GAS_POLICIES);

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
    gas,
  } satisfies BuildCtx & { route: WithdrawRoute };
}
