// src/adapters/ethers/resources/withdrawals/context.ts
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { type TransactionRequest } from 'ethers';
import type { EthersClient } from '../../client';
import type { Address } from '../../../../core/types/primitives';
import { pickWithdrawRoute } from '../../../../core/withdrawals/route';
import type { WithdrawParams, WithdrawRoute } from '../../../../core/types/flows/withdrawals';
import type { CommonCtx } from '../../../../core/types/flows/base';

/** BuildCtx specialized for withdrawals (L2 send + optional L1 finalize) */
export interface BuildCtx extends CommonCtx {
  client: EthersClient;

  // L1 + L2 well-knowns
  l1AssetRouter: Address;
  l1Nullifier: Address;
  l2AssetRouter: Address;
  l2NativeTokenVault: Address;
  l2BaseTokenSystem: Address;

  // L2 gas knobs for the withdraw tx
  l2GasLimit: bigint;
  gasBufferPct: number;

  // Optional fee overrides for L2 send (kept here to mirror deposits style; may be unused)
  fee?: Partial<TransactionRequest>;
}

export async function commonCtx(
  p: WithdrawParams,
  client: EthersClient,
): Promise<BuildCtx & { route: WithdrawRoute }> {
  const sender = (await client.signer.getAddress()) as Address;

  // Resolve Bridgehub (L1) + L2 chain id
  const {
    bridgehub,
    l1AssetRouter,
    nullifier: l1Nullifier,
    l2AssetRouter,
    l2NativeTokenVault,
    l2BaseTokenSystem,
  } = await client.ensureAddresses();

  const { chainId } = await client.l2.getNetwork();
  const chainIdL2 = BigInt(chainId);

  // Route: eth | erc20
  const route = pickWithdrawRoute(p.token);

  // L2 gas knobs (route-specific estimators can refine later)
  const l2GasLimit = p.l2GasLimit ?? 300_000n;
  const gasBufferPct = 15;

  return {
    // CommonCtx
    client,
    bridgehub,
    chainIdL2,
    sender,

    // Route
    route,

    // Well-knowns (from client cache)
    l1AssetRouter,
    l1Nullifier,
    l2AssetRouter,
    l2NativeTokenVault,
    l2BaseTokenSystem,

    // Gas knobs
    l2GasLimit,
    gasBufferPct,
  } satisfies BuildCtx & { route: WithdrawRoute };
}
