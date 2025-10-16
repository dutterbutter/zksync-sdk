// src/adapters/ethers/resources/withdrawals/context.ts

import { type TransactionRequest } from 'ethers';
import type { EthersClient } from '../../client';
import type { Address } from '../../../../core/types/primitives';
import { pickWithdrawRoute } from '../../../../core/resources/withdrawals/route';
import type { WithdrawParams, WithdrawRoute } from '../../../../core/types/flows/withdrawals';
import type { CommonCtx } from '../../../../core/types/flows/base';
import { isEthBasedChain } from '../token-info';
import { GasPlanner, DEFAULT_GAS_POLICIES } from '../../../../core/gas';

// Common context for building withdrawal (L2 -> L1) transactions
export interface BuildCtx extends CommonCtx {
  client: EthersClient;

  // L1 + L2 well-knowns
  l1AssetRouter: Address;
  l1Nullifier: Address;
  l2AssetRouter: Address;
  l2NativeTokenVault: Address;
  l2BaseTokenSystem: Address;

  // Base token info
  baseIsEth: boolean;

  // L2 gas
  l2GasLimit: bigint;
  gasBufferPct: number;

  // Optional fee overrides for L2 send
  fee?: Partial<TransactionRequest>;
  gas: GasPlanner<TransactionRequest>;
}

export async function commonCtx(
  p: WithdrawParams,
  client: EthersClient,
  opts: { allowMissingSender?: boolean } = {},
): Promise<BuildCtx & { route: WithdrawRoute }> {
  let sender = p.sender as Address | undefined;
  if (!sender) {
    try {
      sender = (await client.signer.getAddress()) as Address;
    } catch {
      sender = undefined;
    }
  }
  if (!sender && !opts.allowMissingSender) {
    throw new Error(
      'Withdrawals require a sender account. Provide params.sender or use a client with a connected signer.',
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

  const { chainId } = await client.l2.getNetwork();
  const chainIdL2 = BigInt(chainId);
  const baseIsEth = await isEthBasedChain(client.l2, l2NativeTokenVault);

  // route selection
  const route = pickWithdrawRoute({ token: p.token, baseIsEth });

  // TODO: improve gas estimations
  const l2GasLimit = p.l2GasLimit ?? 300_000n;
  const gasBufferPct = 15;
  const gasPlanner = new GasPlanner<TransactionRequest>(DEFAULT_GAS_POLICIES);

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
    gas: gasPlanner,
  } satisfies BuildCtx & { route: WithdrawRoute };
}
