// src/adapters/viem/client.ts
import type {
  PublicClient,
  WalletClient,
  Account,
  Chain,
  Transport,
  GetContractReturnType,
} from 'viem';
import { getContract, createWalletClient } from 'viem';
import type { ZksRpc } from '../../core/rpc/zks';
import { zksRpcFromViem } from './rpc';

import type { Address } from '../../core/types/primitives'; // ← use your core Address type
import {
  L2_ASSET_ROUTER_ADDR,
  L2_NATIVE_TOKEN_VAULT_ADDR,
  L2_BASE_TOKEN_SYSTEM_CONTRACT_ADDR as L2_BASE_TOKEN_ADDRESS,
} from '../../core/constants';

// ABIs from internal snapshot (same as ethers adapter)
import IBridgehubABI from '../../core/internal/abis/IBridgehub.json';
import IL1AssetRouterABI from '../../core/internal/abis/IL1AssetRouter.json';
import IL1NullifierABI from '../../core/internal/abis/IL1Nullifier.json';
import IL2AssetRouterABI from '../../core/internal/abis/IL2AssetRouter.json';
import L2NativeTokenVaultABI from '../../core/internal/abis/L2NativeTokenVault.json';
import L1NativeTokenVaultABI from '../../core/internal/abis/L1NativeTokenVault.json';
import IBaseTokenABI from '../../core/internal/abis/IBaseToken.json';

export interface ResolvedAddresses {
  bridgehub: Address;
  l1AssetRouter: Address;
  l1Nullifier: Address;
  l1NativeTokenVault: Address;
  l2AssetRouter: Address;
  l2NativeTokenVault: Address;
  l2BaseTokenSystem: Address;
}

export interface ViemClient {
  readonly kind: 'viem';
  readonly l1: PublicClient;
  readonly l2: PublicClient;
  readonly l1Wallet: WalletClient<Transport, Chain, Account>;
  readonly l2Wallet?: WalletClient<Transport, Chain, Account>;
  readonly account: Account;
  readonly zks: ZksRpc;

  ensureAddresses(): Promise<ResolvedAddresses>;
  getL2Wallet(): WalletClient<Transport, Chain, Account>;
  contracts(): Promise<{
    bridgehub: GetContractReturnType<typeof IBridgehubABI, PublicClient>;
    l1AssetRouter: GetContractReturnType<typeof IL1AssetRouterABI, PublicClient>;
    l1Nullifier: GetContractReturnType<typeof IL1NullifierABI, PublicClient>;
    l1NativeTokenVault: GetContractReturnType<typeof L1NativeTokenVaultABI, PublicClient>;
    l2AssetRouter: GetContractReturnType<typeof IL2AssetRouterABI, PublicClient>;
    l2NativeTokenVault: GetContractReturnType<typeof L2NativeTokenVaultABI, PublicClient>;
    l2BaseTokenSystem: GetContractReturnType<typeof IBaseTokenABI, PublicClient>;
  }>;
  refresh(): void;
  baseToken(chainId: bigint): Promise<Address>;
}

type InitArgs = {
  l1: PublicClient;
  l2: PublicClient;
  l1Wallet: WalletClient<Transport, Chain, Account>;
  l2Wallet?: WalletClient<Transport, Chain, Account>;
  overrides?: Partial<ResolvedAddresses>;
};

export function createViemClient(args: InitArgs): ViemClient {
  const { l1, l2, l1Wallet, l2Wallet } = args;
  if (!l1Wallet.account) {
    throw new Error('WalletClient must have an account configured.');
  }
  if (l2Wallet && !l2Wallet.account) throw new Error('l2Wallet provided without an account.');

  const zks = zksRpcFromViem(l2);

  let addrCache: ResolvedAddresses | undefined;
  let cCache:
    | {
        bridgehub: GetContractReturnType<typeof IBridgehubABI, PublicClient>;
        l1AssetRouter: GetContractReturnType<typeof IL1AssetRouterABI, PublicClient>;
        l1Nullifier: GetContractReturnType<typeof IL1NullifierABI, PublicClient>;
        l1NativeTokenVault: GetContractReturnType<typeof L1NativeTokenVaultABI, PublicClient>;
        l2AssetRouter: GetContractReturnType<typeof IL2AssetRouterABI, PublicClient>;
        l2NativeTokenVault: GetContractReturnType<typeof L2NativeTokenVaultABI, PublicClient>;
        l2BaseTokenSystem: GetContractReturnType<typeof IBaseTokenABI, PublicClient>;
      }
    | undefined;

  async function ensureAddresses(): Promise<ResolvedAddresses> {
    if (addrCache) return addrCache;

    // Bridgehub via zks_getBridgehubContract
    const bridgehub = args.overrides?.bridgehub ?? (await zks.getBridgehubAddress());

    // L1 AssetRouter via Bridgehub.assetRouter()
    const l1AssetRouter =
      args.overrides?.l1AssetRouter ??
      ((await l1.readContract({
        address: bridgehub,
        abi: IBridgehubABI,
        functionName: 'assetRouter',
      })) as Address);

    // L1Nullifier via L1AssetRouter.L1_NULLIFIER()
    const l1Nullifier =
      args.overrides?.l1Nullifier ??
      ((await l1.readContract({
        address: l1AssetRouter,
        abi: IL1AssetRouterABI,
        functionName: 'L1_NULLIFIER',
      })) as Address);

    // L1NativeTokenVault via L1Nullifier.l1NativeTokenVault()
    const l1NativeTokenVault =
      args.overrides?.l1NativeTokenVault ??
      ((await l1.readContract({
        address: l1Nullifier,
        abi: IL1NullifierABI,
        functionName: 'l1NativeTokenVault',
      })) as Address);

    // L2 addresses from constants (overridable)
    const l2AssetRouter = args.overrides?.l2AssetRouter ?? L2_ASSET_ROUTER_ADDR;
    const l2NativeTokenVault = args.overrides?.l2NativeTokenVault ?? L2_NATIVE_TOKEN_VAULT_ADDR;
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

  async function contracts() {
    if (cCache) return cCache;
    const a = await ensureAddresses();

    cCache = {
      bridgehub: getContract({ address: a.bridgehub, abi: IBridgehubABI, client: l1 }),
      l1AssetRouter: getContract({ address: a.l1AssetRouter, abi: IL1AssetRouterABI, client: l1 }),
      l1Nullifier: getContract({ address: a.l1Nullifier, abi: IL1NullifierABI, client: l1 }),
      l1NativeTokenVault: getContract({
        address: a.l1NativeTokenVault,
        abi: L1NativeTokenVaultABI,
        client: l1,
      }),
      l2AssetRouter: getContract({ address: a.l2AssetRouter, abi: IL2AssetRouterABI, client: l2 }),
      l2NativeTokenVault: getContract({
        address: a.l2NativeTokenVault,
        abi: L2NativeTokenVaultABI,
        client: l2,
      }),
      l2BaseTokenSystem: getContract({
        address: a.l2BaseTokenSystem,
        abi: IBaseTokenABI,
        client: l2,
      }),
    };
    return cCache;
  }

  function refresh() {
    addrCache = undefined;
    cCache = undefined;
  }

  async function baseToken(chainId: bigint): Promise<Address> {
    const { bridgehub } = await ensureAddresses();
    const token = (await l1.readContract({
      address: bridgehub,
      abi: IBridgehubABI,
      functionName: 'baseToken',
      args: [chainId],
    })) as Address;
    return token;
  }

  let lazyL2: WalletClient<Transport, Chain, Account> | undefined;
  function getL2Wallet(): WalletClient<Transport, Chain, Account> {
    if (l2Wallet) return l2Wallet;
    if (!lazyL2) {
      lazyL2 = createWalletClient({
        account: l1Wallet.account,
        transport: l2.transport as unknown as Transport,
      });
    }
    return lazyL2;
  }

  return {
    kind: 'viem',
    l1,
    l2,
    l1Wallet,
    l2Wallet,
    account: l1Wallet.account,
    zks,
    ensureAddresses,
    contracts,
    refresh,
    baseToken,
    getL2Wallet,
  };
}

export type { InitArgs as ViemClientInit };
