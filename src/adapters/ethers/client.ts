// src/adapters/ethers/client.ts
import type { AbstractProvider, ContractRunner, Signer } from 'ethers';
import { Contract, Interface } from 'ethers';
import type { Address } from '../../core/types/primitives';
import type { ZksRpc } from '../../core/rpc/zks';
import { zksRpcFromEthers } from './rpc';
import {
  L2_ASSET_ROUTER_ADDR,
  L2_NATIVE_TOKEN_VAULT_ADDR,
  L2_BASE_TOKEN_SYSTEM_CONTRACT_ADDR as L2_BASE_TOKEN_ADDRESS,
} from '../../core/constants';

import IBridgehubABI from '../../internal/abis/IBridgehub.json';
import IL1AssetRouterABI from '../../internal/abis/IL1AssetRouter.json';
import IL1NullifierABI from '../../internal/abis/IL1Nullifier.json';
import IL2AssetRouterABI from '../../internal/abis/IL2AssetRouter.json';
import L2NativeTokenVaultABI from '../../internal/abis/L2NativeTokenVault.json';
import L1NativeTokenVaultABI from '../../internal/abis/L1NativeTokenVault.json';
import IBaseTokenABI from '../../internal/abis/IBaseToken.json';

export interface ResolvedAddresses {
  bridgehub: Address;
  l1AssetRouter: Address;
  l1Nullifier: Address;
  l1NativeTokenVault: Address;
  l2AssetRouter: Address;
  l2NativeTokenVault: Address;
  l2BaseTokenSystem: Address;
}

export interface EthersClient {
  /** Discriminator */
  readonly kind: 'ethers';
  /** L1 read/write provider */
  readonly l1: AbstractProvider;
  /** L2 read-only provider (target ZK chain) */
  readonly l2: AbstractProvider;
  /** Signer used for sends (must be connected to L1 provider for L1 txs) */
  readonly signer: Signer;
  /** ZK Sync-specific RPC methods */
  readonly zks: ZksRpc;

  /** Cached resolved addresses */
  ensureAddresses(): Promise<ResolvedAddresses>;

  /** Convenience: connected ethers.Contract instances */
  contracts(): Promise<{
    bridgehub: Contract;
    l1AssetRouter: Contract;
    l1Nullifier: Contract;
    l1NativeTokenVault: Contract;
    l2AssetRouter: Contract;
    l2NativeTokenVault: Contract;
    l2BaseTokenSystem: Contract;
  }>;

  /** Clear all cached addresses/contracts. */
  refresh(): void;

  /** Lookup the base token for a given chain ID via Bridgehub.baseToken(chainId) */
  baseToken(chainId: bigint): Promise<Address>;
}

type InitArgs = {
  /** L1 provider */
  l1: AbstractProvider;
  /** L2 provider */
  l2: AbstractProvider;
  /** Signer for sending txs. */
  signer: Signer;
  /** Optional manual overrides */
  overrides?: Partial<ResolvedAddresses>;
};

/**
 * Create an EthersClient: a thin handle that carries providers/signer and
 * resolves the minimal addresses needed by resources.
 */
export function createEthersClient(args: InitArgs): EthersClient {
  const { l1, l2, signer } = args;

  // Ensure signer is connected to L1 provider; if not, connect it.
  let boundSigner = signer;
  if (!boundSigner.provider || (boundSigner.provider as unknown as ContractRunner) !== l1) {
    boundSigner = signer.connect(l1);
  }

  // lazily bind zks rpc to the L2 provider
  const zks = zksRpcFromEthers(l2);

  // Caches
  let addrCache: ResolvedAddresses | undefined;
  let cCache:
    | {
        bridgehub: Contract;
        l1AssetRouter: Contract;
        l1Nullifier: Contract;
        l1NativeTokenVault: Contract;
        l2AssetRouter: Contract;
        l2NativeTokenVault: Contract;
        l2BaseTokenSystem: Contract;
      }
    | undefined;

  async function ensureAddresses(): Promise<ResolvedAddresses> {
    if (addrCache) return addrCache;

    // Bridgehub
    const bridgehub = args.overrides?.bridgehub ?? (await zks.getBridgehubAddress());

    // L1 AssetRouter via Bridgehub.assetRouter()
    const IBridgehub = new Interface(IBridgehubABI);
    const bh = new Contract(bridgehub, IBridgehub, l1);
    const l1AssetRouter = args.overrides?.l1AssetRouter ?? ((await bh.assetRouter()) as Address);

    // L1Nullifier via L1AssetRouter.L1_NULLIFIER()
    const IL1AssetRouter = new Interface(IL1AssetRouterABI);
    const ar = new Contract(l1AssetRouter, IL1AssetRouter, l1);
    const l1Nullifier = args.overrides?.l1Nullifier ?? ((await ar.L1_NULLIFIER()) as Address);

    // L1NativeTokenVault via L1Nullifier.l1NativeTokenVault()
    const IL1Nullifier = new Interface(IL1NullifierABI);
    const nf = new Contract(l1Nullifier, IL1Nullifier, l1);
    const l1NativeTokenVault =
      args.overrides?.l1NativeTokenVault ?? ((await nf.l1NativeTokenVault()) as Address);

    // L2AssetRouter
    const l2AssetRouter = args.overrides?.l2AssetRouter ?? L2_ASSET_ROUTER_ADDR;

    // L2NativeTokenVault
    const l2NativeTokenVault = args.overrides?.l2NativeTokenVault ?? L2_NATIVE_TOKEN_VAULT_ADDR;

    // L2BaseToken
    const l2BaseTokenSystem = args.overrides?.l2BaseTokenSystem ?? L2_BASE_TOKEN_ADDRESS;

    addrCache = {
      bridgehub,
      l1AssetRouter,
      l1Nullifier,
      l1NativeTokenVault,
      l2AssetRouter,
      l2NativeTokenVault,
      l2BaseTokenSystem,
    };
    return addrCache;
  }

  // lazily create connected contract instances for convenience
  async function contracts() {
    if (cCache) return cCache;
    const a = await ensureAddresses();

    cCache = {
      bridgehub: new Contract(a.bridgehub, IBridgehubABI, l1),
      l1AssetRouter: new Contract(a.l1AssetRouter, IL1AssetRouterABI, l1),
      l1Nullifier: new Contract(a.l1Nullifier, IL1NullifierABI, l1),
      l1NativeTokenVault: new Contract(a.l1NativeTokenVault, L1NativeTokenVaultABI, l1),
      l2AssetRouter: new Contract(a.l2AssetRouter, IL2AssetRouterABI, l2),
      l2NativeTokenVault: new Contract(a.l2NativeTokenVault, L2NativeTokenVaultABI, l2),
      l2BaseTokenSystem: new Contract(a.l2BaseTokenSystem, IBaseTokenABI, l2),
    };
    return cCache;
  }

  // clear caches
  function refresh() {
    addrCache = undefined;
    cCache = undefined;
  }

  // lookup base token for a given chain ID via Bridgehub.baseToken(chainId)
  async function baseToken(chainId: bigint): Promise<Address> {
    const { bridgehub } = await ensureAddresses();
    const bh = new Contract(bridgehub, IBridgehubABI, l1);

    return (await bh.baseToken(chainId)) as Address;
  }

  const client: EthersClient = {
    kind: 'ethers',
    l1,
    l2,
    signer: boundSigner,
    zks,
    ensureAddresses,
    contracts,
    refresh,
    baseToken,
  };

  return client;
}

export type { InitArgs as EthersClientInit };
