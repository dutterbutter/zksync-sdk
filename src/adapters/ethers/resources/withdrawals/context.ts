// src/adapters/ethers/resources/withdrawals/context.ts
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Contract, type TransactionRequest } from 'ethers';
import type { EthersClient } from '../../client';
import type { Address } from '../../../../types/primitives';
import type { WithdrawParams, WithdrawRoute } from '../../../../types/flows/withdrawals';
import type { CommonCtx } from '../../../../types/flows/base';
import IBridgehubABI from '../../../../internal/abis/json/IBridgehub.json' assert { type: 'json' };
import IL1AssetRouterABI from '../../../../internal/abis/json/IL1AssetRouter.json' assert { type: 'json' };
import {
  L2_BASE_TOKEN_SYSTEM_CONTRACT_ADDR,
  L2_ASSET_ROUTER_ADDR,
  L2_NATIVE_TOKEN_VAULT_ADDR,
  isETH,
} from '../utils';

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

/** Route picker for withdrawals: ETH uses base-token system contract; ERC-20 uses L2AssetRouter */
function pickWithdrawRoute(token: Address): WithdrawRoute {
  return isETH(token) ? 'eth' : 'erc20';
}

export async function commonCtx(
  p: WithdrawParams,
  client: EthersClient,
): Promise<BuildCtx & { route: WithdrawRoute }> {
  const sender = (await client.signer.getAddress()) as Address;

  // Resolve Bridgehub (L1) + L2 chain id
  const { bridgehub } = await client.ensureAddresses();
  const { chainId } = await client.l2.getNetwork();
  const chainIdL2 = BigInt(chainId);

  // --- L1 side: get L1AssetRouter, then query its L1_NULLIFIER() ---
  const bh = new Contract(bridgehub, IBridgehubABI, client.l1);
  const l1AssetRouter = (await bh.assetRouter()) as Address;
  const ar = new Contract(l1AssetRouter, IL1AssetRouterABI, client.l1);
  const l1Nullifier = (await ar.nativeTokenVault()) as Address;

  // --- L2 side: predeploys (fixed addresses) ---
  const l2AssetRouter = L2_ASSET_ROUTER_ADDR as Address;
  const l2NativeTokenVault = L2_NATIVE_TOKEN_VAULT_ADDR as Address;
  const l2BaseTokenSystem = L2_BASE_TOKEN_SYSTEM_CONTRACT_ADDR as Address;

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

    // Well-knowns
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
