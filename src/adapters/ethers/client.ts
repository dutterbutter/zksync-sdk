// src/adapters/ethers/client.ts
import type { AbstractProvider, ContractRunner, Signer } from 'ethers';
import { Contract, Interface, JsonRpcProvider } from 'ethers';
import type { Address } from '../../core/types/primitives';
import type { ZksRpc } from '../../core/rpc/zks';
import { zksRpcFromEthers } from './rpc';

import {
  L2_ASSET_ROUTER_ADDRESS,
  L2_NATIVE_TOKEN_VAULT_ADDRESS,
  L2_BASE_TOKEN_ADDRESS,
  L2_INTEROP_CENTER_ADDRESS,
  L2_INTEROP_HANDLER_ADDRESS,
} from '../../core/constants';

import {
  IBridgehubABI,
  IL1AssetRouterABI,
  IL1NullifierABI,
  IL2AssetRouterABI,
  L2NativeTokenVaultABI,
  L1NativeTokenVaultABI,
  IBaseTokenABI,
  InteropCenterABI,
  IInteropHandlerABI,
} from '../../core/internal/abi-registry';

/** ---------------- Types ---------------- */

export interface ResolvedAddresses {
  // L1 & L2 (deposits/withdrawals)
  bridgehub: Address;
  l1AssetRouter: Address;
  l1Nullifier: Address;
  l1NativeTokenVault: Address;
  l2AssetRouter: Address;
  l2NativeTokenVault: Address;
  l2BaseTokenSystem: Address;

  // Interop
  interopCenter: Address;
  interopHandler: Address;
}

export interface EthersClient {
  /** Discriminator */
  readonly kind: 'ethers';

  /** L1 read/write provider */
  readonly l1: AbstractProvider;

  /** Current/source L2 (unchanged) */
  readonly l2: AbstractProvider;

  /** Signer (connected to L1 by default; use signerFor to re-bind) */
  readonly signer: Signer;

  /** ZKsync-specific RPC bound to the current/source L2 */
  readonly zks: ZksRpc;

  /** Cached resolved addresses (L1/L2 + interop) */
  ensureAddresses(): Promise<ResolvedAddresses>;

  /** Convenience: connected ethers.Contract instances (source-bound) */
  contracts(): Promise<{
    // L1
    bridgehub: Contract;
    l1AssetRouter: Contract;
    l1Nullifier: Contract;
    l1NativeTokenVault: Contract;
    // L2 (source)
    l2AssetRouter: Contract;
    l2NativeTokenVault: Contract;
    l2BaseTokenSystem: Contract;
    // Interop (source L2 bound)
    interopCenter: Contract;
    interopHandler: Contract;
  }>;

  /** Clear all cached addresses/contracts. */
  refresh(): void;

  /** Lookup the base token for a given chain ID via Bridgehub.baseToken(chainId) */
  baseToken(chainId: bigint): Promise<Address>;

  /** Chain registry for interop destinations */
  registerChain(chainId: bigint, providerOrUrl: AbstractProvider | string): void;
  registerChains(map: Record<string, AbstractProvider | string>): void;
  getProvider(chainId: bigint): AbstractProvider | undefined;
  requireProvider(chainId: bigint): AbstractProvider;
  listChains(): bigint[];

  /** Get a signer connected to L1 or a specific L2 */
  signerFor(target?: 'l1' | bigint): Signer;
}

type InitArgs = {
  /** L1 provider (required for deposits/withdrawals & baseToken lookups) */
  l1: AbstractProvider;
  /** L2 provider (the “current/source” L2; unchanged) */
  l2: AbstractProvider;
  /** Signer for sending txs. Will be connected to appropriate provider via signerFor. */
  signer: Signer;

  /** Optional pre-seeded chain registry (eip155 → provider) for interop destinations */
  chains?: Record<string, AbstractProvider>;

  /** Optional manual overrides for addresses (rarely needed) */
  overrides?: Partial<
    Omit<
      ResolvedAddresses,
      // these three are hard-wired constants by default (but still overrideable if you insist)
      'l2AssetRouter' | 'l2NativeTokenVault' | 'l2BaseTokenSystem'
    >
  > & {
    l2AssetRouter?: Address;
    l2NativeTokenVault?: Address;
    l2BaseTokenSystem?: Address;
  };
};

/** ---------------- Implementation ---------------- */

export function createEthersClient(args: InitArgs): EthersClient {
  const { l1, l2, signer, chains, overrides } = args;

  // Ensure signer is connected to L1 by default; resources can re-bind with signerFor('l1'|chainId).
  let boundSigner = signer;
  if (!boundSigner.provider || (boundSigner.provider as unknown as ContractRunner) !== l1) {
    boundSigner = signer.connect(l1);
  }

  // Chain registry for interop destinations (and any extra L2 lookups)
  const chainMap = new Map<bigint, AbstractProvider>();
  if (chains) {
    for (const [k, p] of Object.entries(chains)) {
      const id = BigInt(k);
      const provider = typeof p === 'string' ? new JsonRpcProvider(p) : p;
      chainMap.set(id, provider);
    }
  }

  // zks RPC bound to the current/source L2 (same behavior as before)
  const zks = zksRpcFromEthers(l2);

  // Caches
  let addrCache: ResolvedAddresses | undefined;
  let cCache:
    | {
        // L1
        bridgehub: Contract;
        l1AssetRouter: Contract;
        l1Nullifier: Contract;
        l1NativeTokenVault: Contract;
        // L2 (source)
        l2AssetRouter: Contract;
        l2NativeTokenVault: Contract;
        l2BaseTokenSystem: Contract;
        // Interop (source L2 bound)
        interopCenter: Contract;
        interopHandler: Contract;
      }
    | undefined;

  /** Address resolution */
  async function ensureAddresses(): Promise<ResolvedAddresses> {
    if (addrCache) return addrCache;

    // L1-side discovery
    const bridgehub = overrides?.bridgehub ?? (await zks.getBridgehubAddress());

    const IBridgehub = new Interface(IBridgehubABI);
    const bh = new Contract(bridgehub, IBridgehub, l1);

    const l1AssetRouter = overrides?.l1AssetRouter ?? ((await bh.assetRouter()) as Address);

    const IL1AssetRouter = new Interface(IL1AssetRouterABI);
    const ar = new Contract(l1AssetRouter, IL1AssetRouter, l1);
    const l1Nullifier = overrides?.l1Nullifier ?? ((await ar.L1_NULLIFIER()) as Address);

    const IL1Nullifier = new Interface(IL1NullifierABI);
    const nf = new Contract(l1Nullifier, IL1Nullifier, l1);
    const l1NativeTokenVault =
      overrides?.l1NativeTokenVault ?? ((await nf.l1NativeTokenVault()) as Address);

    // L2 (source) constants (can be overridden)
    const l2AssetRouter = overrides?.l2AssetRouter ?? L2_ASSET_ROUTER_ADDRESS;
    const l2NativeTokenVault = overrides?.l2NativeTokenVault ?? L2_NATIVE_TOKEN_VAULT_ADDRESS;
    const l2BaseTokenSystem = overrides?.l2BaseTokenSystem ?? L2_BASE_TOKEN_ADDRESS;

    // Interop addresses (same on every L2; overrideable)
    const interopCenter = overrides?.interopCenter ?? L2_INTEROP_CENTER_ADDRESS;
    const interopHandler = overrides?.interopHandler ?? L2_INTEROP_HANDLER_ADDRESS;

    if (!interopCenter || !interopHandler) {
      throw new Error(
        'Interop addresses missing. Ensure L2_INTEROP_CENTER_ADDRESS / L2_INTEROP_HANDLER_ADDRESS are set in core/constants or provide overrides.',
      );
    }

    addrCache = {
      bridgehub,
      l1AssetRouter,
      l1Nullifier,
      l1NativeTokenVault,
      l2AssetRouter,
      l2NativeTokenVault,
      l2BaseTokenSystem,
      interopCenter,
      interopHandler,
    };
    return addrCache;
  }

  /** Contracts (source-bound instances) */
  async function contracts() {
    if (cCache) return cCache;
    const a = await ensureAddresses();

    cCache = {
      // L1
      bridgehub: new Contract(a.bridgehub, IBridgehubABI, l1),
      l1AssetRouter: new Contract(a.l1AssetRouter, IL1AssetRouterABI, l1),
      l1Nullifier: new Contract(a.l1Nullifier, IL1NullifierABI, l1),
      l1NativeTokenVault: new Contract(a.l1NativeTokenVault, L1NativeTokenVaultABI, l1),
      // L2 (source)
      l2AssetRouter: new Contract(a.l2AssetRouter, IL2AssetRouterABI, l2),
      l2NativeTokenVault: new Contract(a.l2NativeTokenVault, L2NativeTokenVaultABI, l2),
      l2BaseTokenSystem: new Contract(a.l2BaseTokenSystem, IBaseTokenABI, l2),
      // Interop (source L2 bound)
      interopCenter: new Contract(a.interopCenter, InteropCenterABI, l2),
      interopHandler: new Contract(a.interopHandler, IInteropHandlerABI, l2),
    };
    return cCache;
  }

  /** Chain registry utilities (for interop destinations) */
  function registerChain(chainId: bigint, providerOrUrl: AbstractProvider | string) {
    const provider =
      typeof providerOrUrl === 'string' ? new JsonRpcProvider(providerOrUrl) : providerOrUrl;
    chainMap.set(chainId, provider);
  }

  function registerChains(map: Record<string, AbstractProvider | string>) {
    for (const [k, p] of Object.entries(map)) {
      registerChain(BigInt(k), p);
    }
  }

  function getProvider(chainId: bigint) {
    return chainMap.get(chainId);
  }
  function requireProvider(chainId: bigint) {
    const p = chainMap.get(chainId);
    if (!p) throw new Error(`No provider registered for destination chainId ${chainId}`);
    return p;
  }
  function listChains(): bigint[] {
    return [...chainMap.keys()];
  }

  /** Signer helpers */
  function signerFor(target?: 'l1' | bigint): Signer {
    if (target === 'l1') {
      return boundSigner.provider === l1 ? boundSigner : boundSigner.connect(l1);
    }
    const provider = typeof target === 'bigint' ? requireProvider(target) : l2; // default to current/source L2
    return boundSigner.provider === provider ? boundSigner : boundSigner.connect(provider);
  }

  /** Housekeeping */
  function refresh() {
    addrCache = undefined;
    cCache = undefined;
  }

  /** Bridgehub convenience */
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
    registerChain,
    registerChains,
    getProvider,
    requireProvider,
    listChains,
    signerFor,
  };

  return client;
}

export type { InitArgs as EthersClientInit };
