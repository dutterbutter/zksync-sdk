/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
// src/adapters/ethers/client.ts
import type { AbstractProvider, ContractRunner, Signer } from 'ethers';
import { isAddress, Contract, Interface } from 'ethers';
import type { Address } from '../../core/types/primitives';
import { ZksRpc } from '../../core/rpc/zks';
import { zksRpcFromEthers } from './rpc';
import { L2_ASSET_ROUTER_ADDR, L2_NATIVE_TOKEN_VAULT_ADDR, L2_BASE_TOKEN_ADDRESS } from '../../core/constants';

import IBridgehubABI from "../../internal/abis/IBridgehub.json";
import IL1AssetRouterABI from "../../internal/abis/IL1AssetRouter.json";
import IL1NullifierABI from "../../internal/abis/IL1Nullifier.json";
import IL2AssetRouterABI from "../../internal/abis/IL2AssetRouter.json";
import IL2NativeTokenVaultABI from "../../internal/abis/IL2NativeTokenVault.json";
import IBaseTokenABI from "../../internal/abis/IBaseToken.json";

export interface ResolvedAddresses {
  bridgehub: Address;
  l1AssetRouter: Address;
  nullifier: Address;
  l1NativeTokenVault: Address;
  l2AssetRouter: Address;
  l2NativeTokenVault: Address;
  l2BaseTokenSystem: Address; 
}

export interface EthersClient {
  readonly kind: 'ethers';
  /** L1 read/write provider (where Bridgehub lives) */
  readonly l1: AbstractProvider;
  /** L2 read-only provider (target ZK chain) */
  readonly l2: AbstractProvider;
  /** Signer used for sends (must be connected to L1 provider for L1 txs) */
  readonly signer: Signer;
  /** ZK Sync-specific RPC methods */
  readonly zks: ZksRpc;

  /** Cached resolved addresses (Bridgehub today; can expand later) */
  ensureAddresses(): Promise<ResolvedAddresses>;

    /** Convenience: connected ethers.Contract instances (also lazily created). */
  contracts(): Promise<{
    bridgehub: Contract;
    l1AssetRouter: Contract;
    nullifier: Contract;
    l1NativeTokenVault: Contract;
    l2AssetRouter: Contract;
    l2NativeTokenVault: Contract;
    l2BaseTokenSystem: Contract;
  }>;

  /** Clear all cached addresses/contracts (e.g. after overrides change). */
  refresh(): void;

  /** Lookup the base token for a given chain ID via Bridgehub.baseToken(chainId) */
  baseToken(chainId: bigint): Promise<Address>;
}

type InitArgs = {
  /** L1 provider (Bridgehub is on L1) */
  l1: AbstractProvider;
  /** L2 provider (used for zks_getBridgehubContract + later L2 reads) */
  l2: AbstractProvider;
  /** Signer for sending L1 txs. Should be connected to `l1` (we’ll ensure it). */
  signer: Signer;
  
  /** Optional manual overrides (handy for local/dev) */
  overrides?: Partial<ResolvedAddresses>;
};

/** Normalize & assert an address-like string into checksummed hex */
function asAddress(x: string): Address {
  if (!isAddress(x)) {
    throw new Error(`Invalid address: ${String(x)}`);
  }
  // ethers returns a checksummed string already; type-cast to our Address
  return x as Address;
}

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
  const zks = zksRpcFromEthers(l2 as any);

  // Caches
  let addrCache: ResolvedAddresses | undefined;
  let cCache:
    | {
        bridgehub: Contract;
        l1AssetRouter: Contract;
        nullifier: Contract;
        l1NativeTokenVault: Contract;
        l2AssetRouter: Contract;
        l2NativeTokenVault: Contract;
        l2BaseTokenSystem: Contract;
      }
    | undefined;

  async function ensureAddresses(): Promise<ResolvedAddresses> {
    if (addrCache) return addrCache;

    // 1) Bridgehub (allow override)
    const bridgehub =
      args.overrides?.bridgehub ??
      asAddress(await zks.getBridgehubAddress());

    // 2) L1 AssetRouter via Bridgehub.assetRouter()
    const IBridgehub = new Interface(IBridgehubABI as any);
    const bh = new Contract(bridgehub, IBridgehub, l1);
    const l1AssetRouter =
      args.overrides?.l1AssetRouter ??
      asAddress(await bh.assetRouter());

    // 3) Nullifier via L1AssetRouter.L1_NULLIFIER()
    const IL1AssetRouter = new Interface(IL1AssetRouterABI as any);
    const ar = new Contract(l1AssetRouter, IL1AssetRouter, l1);
    const nullifier =
      args.overrides?.nullifier ??
      asAddress(await ar.L1_NULLIFIER());

    // 4) NTV via L1Nullifier.l1NativeTokenVault() (public var)
    const IL1Nullifier = new Interface(IL1NullifierABI as any);
    const nf = new Contract(nullifier, IL1Nullifier, l1);
    const l1NativeTokenVault =
      args.overrides?.l1NativeTokenVault ??
      asAddress(await nf.l1NativeTokenVault());

    // 5) L2 AssetRouter (default known addr unless override provided)
    const l2AssetRouter = asAddress(
      args.overrides?.l2AssetRouter ?? L2_ASSET_ROUTER_ADDR,
    );

        // 6) L2 NTV (predeploy; allow override)
    const l2NativeTokenVault = asAddress(
      args.overrides?.l2NativeTokenVault ?? L2_NATIVE_TOKEN_VAULT_ADDR
    );

    // 7) L2 BaseToken System (predeploy; allow override)
    const l2BaseTokenSystem = asAddress(
      args.overrides?.l2BaseTokenSystem ?? L2_BASE_TOKEN_ADDRESS
    );

    addrCache = { bridgehub, l1AssetRouter, nullifier, l1NativeTokenVault, l2AssetRouter, l2NativeTokenVault, l2BaseTokenSystem };
    return addrCache;
  }

  async function contracts() {
    if (cCache) return cCache;
    const a = await ensureAddresses();

    cCache = {
      bridgehub: new Contract(a.bridgehub, IBridgehubABI as any, l1),
      l1AssetRouter: new Contract(a.l1AssetRouter, IL1AssetRouterABI as any, l1),
      nullifier: new Contract(a.nullifier, IL1NullifierABI as any, l1),
      l1NativeTokenVault: new Contract(a.l1NativeTokenVault, /* NTV ABI */ (await import("../../internal/abis/IL1NativeTokenVault.json")).default as any, l1),
      l2AssetRouter: new Contract(a.l2AssetRouter, IL2AssetRouterABI as any, l2),
      l2NativeTokenVault: new Contract(a.l2NativeTokenVault, IL2NativeTokenVaultABI as any, l2),
      l2BaseTokenSystem: new Contract(a.l2BaseTokenSystem, IBaseTokenABI as any, l2),
    };
    return cCache;
  }

  function refresh() {
    addrCache = undefined;
    cCache = undefined;
  }

  async function baseToken(
    chainId: bigint,
  ): Promise<Address> {
    const { bridgehub } = await ensureAddresses();
    const bh = new Contract(bridgehub, IBridgehubABI as any, l1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const addr = await bh.baseToken(chainId);
    return asAddress(addr);
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
    baseToken
  };

  return client;
}

export type { InitArgs as EthersClientInit };
