import { AbiCoder, ethers } from 'ethers';
import type { Address } from '../../../core/types';
import {
  L2_NATIVE_TOKEN_VAULT_ADDRESS,
  L1_FEE_ESTIMATION_COEF_DENOMINATOR,
  L1_FEE_ESTIMATION_COEF_NUMERATOR,
} from '../../../core/constants';
import { type TransactionRequest } from 'ethers';
import type { EthersClient } from '../client';

// TODO: refactor this entirely
// separate encoding, and move gas helpers to new resource

// Returns the assetId for a token in the Native Token Vault with specific origin chainId and address
export function encodeNativeTokenVaultAssetId(chainId: bigint, address: string) {
  const abi = new AbiCoder();
  const hex = abi.encode(
    ['uint256', 'address', 'address'],
    [chainId, L2_NATIVE_TOKEN_VAULT_ADDRESS, address],
  );
  return ethers.keccak256(hex);
}

// Encodes the data for a transfer of a token through the Native Token Vault
export function encodeNativeTokenVaultTransferData(
  amount: bigint,
  receiver: Address,
  token: Address,
) {
  return new AbiCoder().encode(['uint256', 'address', 'address'], [amount, receiver, token]);
}

// Encodes the data for a second bridge transfer
export function encodeSecondBridgeDataV1(assetId: string, transferData: string) {
  const abi = new AbiCoder();
  const data = abi.encode(['bytes32', 'bytes'], [assetId, transferData]);

  return ethers.concat(['0x01', data]);
}
// Encodes the data for a second bridge transfer
export function encodeNTVAssetId(chainId: bigint, address: string) {
  const abi = new AbiCoder();
  const hex = abi.encode(
    ['uint256', 'address', 'address'],
    [chainId, L2_NATIVE_TOKEN_VAULT_ADDRESS, address],
  );
  return ethers.keccak256(hex);
}

// Encodes the data for a transfer of a token through the Native Token Vault
export function encodeNTVTransferData(amount: bigint, receiver: Address, token: Address) {
  return new AbiCoder().encode(['uint256', 'address', 'address'], [amount, receiver, token]);
}

// Scales the provided gas limit by the L1 fee estimation coefficient
export function scaleGasLimit(gasLimit: bigint): bigint {
  return (
    (gasLimit * BigInt(L1_FEE_ESTIMATION_COEF_NUMERATOR)) /
    BigInt(L1_FEE_ESTIMATION_COEF_DENOMINATOR)
  );
}

// Checks the base cost is not higher than the provided value
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

// Fetches the gas price in wei
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
