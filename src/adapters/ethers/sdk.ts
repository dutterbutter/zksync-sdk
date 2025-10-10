// src/adapters/ethers/sdk.ts
import type { Contract } from 'ethers';
import type { EthersClient, ResolvedAddresses } from './client';
import {
  createDepositsResource,
  type DepositsResource as DepositsResourceType,
} from './resources/deposits/index';
import {
  createWithdrawalsResource,
  type WithdrawalsResource as WithdrawalsResourceType,
} from './resources/withdrawals/index';
import { type Address, type Hex } from '../../core/types';
import { isAddressEq } from '../../core/utils/addr';
import { L2_BASE_TOKEN_ADDRESS, ETH_ADDRESS, FORMAL_ETH_ADDRESS } from '../../core/constants';

/**
 * @summary The main entry point for interacting with the ZKsync network using the Ethers.js adapter.
 * @description This SDK object provides access to all major functionalities, including deposits,
 * withdrawals, and various utility helpers for address and contract resolution.
 */
export interface EthersSdk {
  /**
   * @summary Provides methods for depositing assets from L1 to L2.
   * @see DepositsResourceType for a full list of methods.
   */
  deposits: DepositsResourceType;
  /**
   * @summary Provides methods for withdrawing assets from L2 to L1.
   * @see WithdrawalsResourceType for a full list of methods.
   */
  withdrawals: WithdrawalsResourceType;
  /**
   * @summary A collection of utility functions for common tasks like resolving addresses,
   * fetching contracts, and converting token addresses.
   */
  helpers: {
    /**
     * @summary Retrieves the resolved L1 and L2 contract addresses used by the SDK.
     * @returns A Promise that resolves to the set of contract addresses.
     */
    addresses(): Promise<ResolvedAddresses>;
    /**
     * @summary Retrieves the Ethers.js Contract instances for all SDK-related contracts.
     * @returns A Promise that resolves to an object containing all relevant contract instances.
     */
    contracts(): Promise<{
      bridgehub: Contract;
      l1AssetRouter: Contract;
      l1Nullifier: Contract;
      l1NativeTokenVault: Contract;
      l2AssetRouter: Contract;
      l2NativeTokenVault: Contract;
      l2BaseTokenSystem: Contract;
    }>;

    /**
     * @summary Gets the L1 Asset Router contract instance.
     * @returns A Promise resolving to the `Contract` instance.
     */
    l1AssetRouter(): Promise<Contract>;
    /**
     * @summary Gets the L1 Native Token Vault contract instance.
     * @returns A Promise resolving to the `Contract` instance.
     */
    l1NativeTokenVault(): Promise<Contract>;
    /**
     * @summary Gets the L1 Nullifier contract instance.
     * @returns A Promise resolving to the `Contract` instance.
     */
    l1Nullifier(): Promise<Contract>;
    /**
     * @summary Retrieves the L1 address of the base token for a given L2 chain.
     * @param chainId The L2 chain ID. If not provided, it's fetched from the L2 provider.
     * @returns A Promise resolving to the base token's L1 address.
     */
    baseToken(chainId?: bigint): Promise<Address>;
    /**
     * @summary Gets the corresponding L2 token address for a given L1 token.
     * @notice This method correctly handles special cases for ETH and the official base token.
     * @param l1Token The address of the token on L1.
     * @returns A Promise resolving to the corresponding token address on L2.
     * @example
     * ```typescript
     * const l1EthAddress = '0x0000000000000000000000000000000000000000';
     * const l2EthAddress = await sdk.helpers.l2TokenAddress(l1EthAddress);
     * console.log(l2EthAddress); // 0x000000000000000000000000000000000000800a
     * ```
     */
    l2TokenAddress(l1Token: Address): Promise<Address>;
    /**
     * @summary Gets the corresponding L1 token address for a given L2 token.
     * @notice This method correctly handles the placeholder address for ETH on L2.
     * @param l2Token The address of the token on L2.
     * @returns A Promise resolving to the corresponding token address on L1.
     */
    l1TokenAddress(l2Token: Address): Promise<Address>;
    /**
     * @summary Calculates the unique asset identifier (`bytes32`) for a given L1 token.
     * @param l1Token The address of the token on L1.
     * @returns A Promise that resolves to the `bytes32` asset ID as a hex string.
     */
    assetId(l1Token: Address): Promise<Hex>;
  };
}

/**
 * @summary Creates an instance of the EthersSdk.
 * @param client An instance of `EthersClient` used for communication with the network.
 * @returns A fully configured `EthersSdk` instance.
 * @internal
 */
export function createEthersSdk(client: EthersClient): EthersSdk {
  return {
    deposits: createDepositsResource(client),
    withdrawals: createWithdrawalsResource(client),

    // TODO: might update to create dedicated resources for these
    helpers: {
      addresses: () => client.ensureAddresses(),
      contracts: () => client.contracts(),

      async l1AssetRouter() {
        const { l1AssetRouter } = await client.contracts();
        return l1AssetRouter;
      },
      async l1NativeTokenVault() {
        const { l1NativeTokenVault } = await client.contracts();
        return l1NativeTokenVault;
      },
      async l1Nullifier() {
        const { l1Nullifier } = await client.contracts();
        return l1Nullifier;
      },

      async baseToken(chainId?: bigint) {
        const id = chainId ?? BigInt((await client.l2.getNetwork()).chainId);
        return client.baseToken(id);
      },

      async l2TokenAddress(l1Token: Address): Promise<Address> {
        // ETH on L1 → contracts’ ETH placeholder on L2
        if (isAddressEq(l1Token, FORMAL_ETH_ADDRESS)) {
          return ETH_ADDRESS;
        }

        // Base token → L2 base-token system address
        const { chainId } = await client.l2.getNetwork();
        const base = await client.baseToken(BigInt(chainId));
        if (isAddressEq(l1Token, base)) {
          return L2_BASE_TOKEN_ADDRESS as Address;
        }

        const { l2NativeTokenVault } = await client.contracts();
        // IL2NativeTokenVault.l2TokenAddress(address) → address
        const addr = (await l2NativeTokenVault.l2TokenAddress(l1Token)) as string;
        return addr as Address;
      },

      async l1TokenAddress(l2Token: Address): Promise<Address> {
        if (isAddressEq(l2Token, ETH_ADDRESS)) {
          return ETH_ADDRESS;
        }

        const { l2AssetRouter } = await client.contracts();
        // IL2AssetRouter.l1TokenAddress(address) → address
        const addr = (await l2AssetRouter.l1TokenAddress(l2Token)) as string;
        return addr as Address;
      },

      async assetId(l1Token: Address): Promise<Hex> {
        const norm = isAddressEq(l1Token, FORMAL_ETH_ADDRESS) ? ETH_ADDRESS : l1Token;

        const { l1NativeTokenVault } = await client.contracts();
        // IL1NativeTokenVault.assetId(address) → bytes32
        const id = (await l1NativeTokenVault.assetId(norm)) as string;
        return id as Hex;
      },
    },
  };
}
