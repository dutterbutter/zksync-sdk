import type { BytesLike } from 'ethers';
import { AbiCoder, ethers } from 'ethers';
import type { Address } from '../../../core/types';
import type { IL1NativeTokenVault } from '../typechain';
import { isAddressEq } from '../../../core/utils/addr';
import {
  L2_NATIVE_TOKEN_VAULT_ADDRESS,
  LEGACY_ETH_ADDRESS,
  ETH_ADDRESS_IN_CONTRACTS,
  L1_FEE_ESTIMATION_COEF_DENOMINATOR,
  L1_FEE_ESTIMATION_COEF_NUMERATOR,
} from '../../../core/constants';
import { type TransactionRequest } from 'ethers';
import type { EthersClient } from '../client';

/* Returns the assetId for a token in the Native Token Vault with specific origin chainId and address*/
export function encodeNativeTokenVaultAssetId(chainId: bigint, address: string) {
  const abi = new AbiCoder();
  const hex = abi.encode(
    ['uint256', 'address', 'address'],
    [chainId, L2_NATIVE_TOKEN_VAULT_ADDRESS, address],
  );
  return ethers.keccak256(hex);
}

/**
 * Resolves the assetId for a token
 **/
export async function resolveAssetId(
  token: Address,
  ntvContract: IL1NativeTokenVault,
): Promise<BytesLike> {
  if (isAddressEq(token, LEGACY_ETH_ADDRESS)) {
    token = ETH_ADDRESS_IN_CONTRACTS;
  }

  // In case only token is provided, we expect that it is a token inside Native Token Vault
  const assetIdFromNTV = await ntvContract.assetId(token);

  if (assetIdFromNTV && assetIdFromNTV !== ethers.ZeroHash) {
    return assetIdFromNTV;
  }

  // Okay, the token have not been registered within the Native token vault.
  // There are two cases when it is possible:
  // - The token is native to L1 (it may or may not be bridged), but it has not been
  // registered within NTV after the Gateway upgrade. We assume that this is not the case
  // as the SDK is expected to work only after the full migration is done.
  // - The token is native to the current chain and it has never been bridged.

  const network = await ntvContract.runner?.provider?.getNetwork();

  if (!network) {
    throw new Error('Can not derive assetId since chainId is not available');
  }

  const ntvAssetId = encodeNativeTokenVaultAssetId(network.chainId, token);

  return ntvAssetId;
}

/**
 * Encodes the data for a transfer of a token through the Native Token Vault
 *
 * @param {bigint} amount The amount of tokens to transfer
 * @param {Address} receiver The address that will receive the tokens
 * @param {Address} token The address of the token being transferred
 * @returns {string} The ABI-encoded transfer data
 **/
export function encodeNativeTokenVaultTransferData(
  amount: bigint,
  receiver: Address,
  token: Address,
) {
  return new AbiCoder().encode(['uint256', 'address', 'address'], [amount, receiver, token]);
}

/**
 * Encodes asset transfer data for BridgeHub contract, using v1 encoding scheme (introduced in v26 upgrade).
 * Can be utilized to encode deposit initiation data.
 *
 * @param {string} assetId - encoded token asset ID
 * @param {string} transferData - encoded transfer data, see `encodeNativeTokenVaultTransferData`
 */ export function encodeSecondBridgeDataV1(assetId: string, transferData: string) {
  const abi = new AbiCoder();
  const data = abi.encode(['bytes32', 'bytes'], [assetId, transferData]);

  return ethers.concat(['0x01', data]);
}

export function encodeNTVAssetId(chainId: bigint, address: string) {
  const abi = new AbiCoder();
  const hex = abi.encode(
    ['uint256', 'address', 'address'],
    [chainId, L2_NATIVE_TOKEN_VAULT_ADDRESS, address],
  );
  return ethers.keccak256(hex);
}

export async function ethAssetId(provider: ethers.Provider) {
  const network = await provider.getNetwork();

  return encodeNTVAssetId(network.chainId, ETH_ADDRESS_IN_CONTRACTS);
}

interface WithToken {
  token: Address;
}

interface WithAssetId {
  assetId: BytesLike;
}

// For backwards compatibility and easier interface lots of methods
// will continue to allow providing either token or assetId
export type WithTokenOrAssetId = WithToken | WithAssetId;

export function encodeNTVTransferData(amount: bigint, receiver: Address, token: Address) {
  return new AbiCoder().encode(['uint256', 'address', 'address'], [amount, receiver, token]);
}

/**
 * Scales the provided gas limit using a coefficient to ensure acceptance of L1->L2 transactions.
 *
 * This function adjusts the gas limit by multiplying it with a coefficient calculated from the
 * `L1_FEE_ESTIMATION_COEF_NUMERATOR` and `L1_FEE_ESTIMATION_COEF_DENOMINATOR` constants.
 *
 * @param gasLimit - The gas limit to be scaled.
 *
 * @example
 *
 * import { utils } from "zksync-ethers";
 *
 * const scaledGasLimit = utils.scaleGasLimit(10_000);
 * // scaledGasLimit = 12_000
 */
export function scaleGasLimit(gasLimit: bigint): bigint {
  return (
    (gasLimit * BigInt(L1_FEE_ESTIMATION_COEF_NUMERATOR)) /
    BigInt(L1_FEE_ESTIMATION_COEF_DENOMINATOR)
  );
}

/**
 * Checks if the transaction's base cost is greater than the provided value, which covers the transaction's cost.
 *
 * @param baseCost The base cost of the transaction.
 * @param value The value covering the transaction's cost.
 * @throws {Error} The base cost must be greater than the provided value.
 *
 * @example
 *
 * import { utils } from "zksync-ethers";
 *
 * const baseCost = 100;
 * const value = 99;
 * try {
 *   await utils.checkBaseCost(baseCost, value);
 * } catch (e) {
 *   // e.message = `The base cost of performing the priority operation is higher than the provided value parameter for the transaction: baseCost: ${baseCost}, provided value: ${value}`,
 * }
 */
export async function checkBaseCost(
  baseCost: ethers.BigNumberish,
  value: ethers.BigNumberish | Promise<ethers.BigNumberish>,
): Promise<void> {
  const resolvedValue = await value;
  if (baseCost > resolvedValue) {
    throw new Error(
      'The base cost of performing the priority operation is higher than the provided value parameter ' +
        `for the transaction: baseCost: ${String(baseCost)}, provided value: ${String(resolvedValue)}!`,
    );
  }
}

// --- Gas + fees ---
export async function getFeeOverrides(
  client: EthersClient,
): Promise<Partial<TransactionRequest> & { gasPriceForBaseCost: bigint }> {
  const fd = await client.l1.getFeeData();
  const use1559 = fd.maxFeePerGas != null && fd.maxPriorityFeePerGas != null;
  const feeOverrides = use1559
    ? { maxFeePerGas: fd.maxFeePerGas, maxPriorityFeePerGas: fd.maxPriorityFeePerGas }
    : { gasPrice: fd.gasPrice };

  const gasPriceForBaseCostBn = fd.gasPrice ?? fd.maxFeePerGas;
  if (gasPriceForBaseCostBn == null) throw new Error('provider returned no gas price data');

  return { ...feeOverrides, gasPriceForBaseCost: BigInt(gasPriceForBaseCostBn.toString()) };
}

export async function getGasPriceWei(client: EthersClient): Promise<bigint> {
  // prefer FeeData.gasPrice if available; fallback to FeeData.maxFeePerGas
  const fd = await client.l1.getFeeData();
  if (fd.gasPrice != null) return BigInt(fd.gasPrice.toString());
  if (fd.maxFeePerGas != null) return BigInt(fd.maxFeePerGas.toString());
  throw new Error('provider returned no gas price data');
}

// --- L2 request builders (ETH direct) ---
export function buildDirectRequestStruct(args: {
  chainId: bigint;
  mintValue: bigint;
  l2GasLimit: bigint;
  gasPerPubdata: bigint;
  refundRecipient: Address;
  l2Contract: Address;
  l2Value: bigint;
}) {
  return {
    chainId: args.chainId,
    l2Contract: args.l2Contract,
    mintValue: args.mintValue,
    l2Value: args.l2Value,
    l2Calldata: '0x',
    l2GasLimit: args.l2GasLimit,
    l2GasPerPubdataByteLimit: args.gasPerPubdata,
    factoryDeps: [] as `0x${string}`[],
    refundRecipient: args.refundRecipient,
  };
}

// --- Two-bridges encoding: ERC20 tuple (token, amount, l2Receiver) ---
export function encodeSecondBridgeErc20Args(
  token: Address,
  amount: bigint,
  l2Receiver: Address,
): `0x${string}` {
  return AbiCoder.defaultAbiCoder().encode(
    ['address', 'uint256', 'address'],
    [token, amount, l2Receiver],
  ) as `0x${string}`;
}
