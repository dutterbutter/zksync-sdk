// src/adapters/viem/resources/utils.ts
import { encodeAbiParameters, keccak256, concat, type Hex } from 'viem';
import { encodeFunctionData, concatHex } from 'viem';
import type { Abi, WalletClient, Transport, Chain, Account } from 'viem';

import type { Address } from '../../../core/types';
import {
  L2_NATIVE_TOKEN_VAULT_ADDRESS, // ← ensure this exists (or swap to *_ADDR)
  L1_FEE_ESTIMATION_COEF_DENOMINATOR,
  L1_FEE_ESTIMATION_COEF_NUMERATOR,
} from '../../../core/constants';

import type { ViemClient } from '../client';

/* -----------------------------------------------------------------------------
 * Native Token Vault encoding
 * ---------------------------------------------------------------------------*/

// Returns the assetId for a token in the Native Token Vault with specific origin chainId and address
export function encodeNativeTokenVaultAssetId(chainId: bigint, address: string): Hex {
  const encoded = encodeAbiParameters(
    [
      { type: 'uint256', name: 'originChainId' },
      { type: 'address', name: 'ntv' },
      { type: 'address', name: 'token' },
    ],
    [chainId, L2_NATIVE_TOKEN_VAULT_ADDRESS, address as Address],
  );
  return keccak256(encoded);
}

// Encodes the data for a transfer of a token through the Native Token Vault
export function encodeNativeTokenVaultTransferData(
  amount: bigint,
  receiver: Address,
  token: Address,
): Hex {
  return encodeAbiParameters(
    [
      { type: 'uint256', name: 'amount' },
      { type: 'address', name: 'receiver' },
      { type: 'address', name: 'token' },
    ],
    [amount, receiver, token],
  );
}

// Encodes the data for a second bridge transfer (V1)
export function encodeSecondBridgeDataV1(assetId: Hex, transferData: Hex): Hex {
  const data = encodeAbiParameters(
    [
      { type: 'bytes32', name: 'assetId' },
      { type: 'bytes', name: 'transferData' },
    ],
    [assetId, transferData],
  );
  return concat(['0x01', data]);
}

/* Aliases kept for parity with ethers utils */
export const encodeNTVAssetId = encodeNativeTokenVaultAssetId;
export const encodeNTVTransferData = encodeNativeTokenVaultTransferData;

/* -----------------------------------------------------------------------------
 * Gas helpers
 * ---------------------------------------------------------------------------*/

export function scaleGasLimit(gasLimit: bigint): bigint {
  return (
    (gasLimit * BigInt(L1_FEE_ESTIMATION_COEF_NUMERATOR)) /
    BigInt(L1_FEE_ESTIMATION_COEF_DENOMINATOR)
  );
}

/** Throws if baseCost > value */
export async function checkBaseCost(
  baseCost: bigint,
  value: bigint | Promise<bigint>,
): Promise<void> {
  const resolved = await value;
  if (baseCost > resolved) {
    throw new Error(
      'The base cost of performing the priority operation is higher than the provided value parameter ' +
        `for the transaction: baseCost: ${String(baseCost)}, provided value: ${String(resolved)}!`,
    );
  }
}

export type FeeOverrides =
  | ({ gasPriceForBaseCost: bigint } & { gasPrice: bigint })
  | ({ gasPriceForBaseCost: bigint } & { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint });

/** Returns EIP-1559 fees when available, otherwise legacy gasPrice. Also returns a gasPriceForBaseCost bigint. */
export async function getFeeOverrides(client: ViemClient): Promise<FeeOverrides> {
  // Prefer EIP-1559 data if the network supports it
  try {
    // viem: estimateFeesPerGas returns { maxFeePerGas, maxPriorityFeePerGas, baseFeePerGas, gasPrice? }
    const fees = await client.l1.estimateFeesPerGas();
    const { maxFeePerGas, maxPriorityFeePerGas } = fees;
    if (maxFeePerGas != null && maxPriorityFeePerGas != null) {
      // For base-cost math, prefer legacy gasPrice if viem provides it; else use maxFeePerGas
      const gasPriceForBaseCost = fees.gasPrice ?? maxFeePerGas;
      return {
        maxFeePerGas,
        maxPriorityFeePerGas,
        gasPriceForBaseCost,
      };
    }
  } catch {
    // fall through to legacy
  }

  // Legacy gasPrice fallback
  const gasPrice = await client.l1.getGasPrice();
  return {
    gasPrice,
    gasPriceForBaseCost: gasPrice,
  };
}

/** Fetches the gas price in wei (legacy) or falls back to maxFeePerGas. */
export async function getGasPriceWei(client: ViemClient): Promise<bigint> {
  try {
    const gp = await client.l1.getGasPrice();
    if (gp != null) return gp;
  } catch {
    // ignore
  }
  try {
    const fees = await client.l1.estimateFeesPerGas();
    if (fees?.maxFeePerGas != null) return fees.maxFeePerGas;
  } catch {
    // ignore
  }
  throw new Error('provider returned no gas price data');
}

/* -----------------------------------------------------------------------------
 * L2 request builders (ETH direct)
 * ---------------------------------------------------------------------------*/

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
    l2Calldata: '0x' as Hex,
    l2GasLimit: args.l2GasLimit,
    l2GasPerPubdataByteLimit: args.gasPerPubdata,
    factoryDeps: [] as Hex[],
    refundRecipient: args.refundRecipient,
  };
}

/* -----------------------------------------------------------------------------
 * Two-bridges encoding: ERC20 tuple (token, amount, l2Receiver)
 * ---------------------------------------------------------------------------*/

export function encodeSecondBridgeErc20Args(
  token: Address,
  amount: bigint,
  l2Receiver: Address,
): Hex {
  return encodeAbiParameters(
    [
      { type: 'address', name: 'token' },
      { type: 'uint256', name: 'amount' },
      { type: 'address', name: 'l2Receiver' },
    ],
    [token, amount, l2Receiver],
  );
}

// viem's write params type
export type WriteParams = Parameters<WalletClient<Transport, Chain, Account>['writeContract']>[0];

export type DisplayTx = {
  to: Address;
  from?: Address;
  data: Hex;
  value?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  gas?: bigint;
  nonce?: number;
};

export type MinimalWriteLike = {
  address: `0x${string}`;
  abi: Abi | readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
  account?: `0x${string}` | Account | null;
  value?: bigint;
  dataSuffix?: `0x${string}`;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  gas?: bigint;
  nonce?: number;
  chain?: Chain | null;
};

export function summarizeWriteRequest(req: MinimalWriteLike): DisplayTx {
  const data = encodeFunctionData({
    abi: req.abi as Abi,
    functionName: req.functionName,
    args: req.args ?? [],
  });

  const withSuffix = req.dataSuffix ? concatHex([data, req.dataSuffix]) : data;
  const from = typeof req.account === 'string' ? req.account : req.account?.address;

  return {
    to: req.address,
    from,
    data: withSuffix,
    value: req.value,
    maxFeePerGas: req.maxFeePerGas,
    maxPriorityFeePerGas: req.maxPriorityFeePerGas,
    gas: req.gas,
    nonce: req.nonce,
  };
}
