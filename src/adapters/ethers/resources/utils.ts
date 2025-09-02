import {
  AbiCoder,
  //   BigNumberish,
  BytesLike,
  ethers,
  //   SignatureLike,
  //   resolveProperties,
  //   Provider,
  //   TransactionLike,
} from 'ethers';
import { Address } from '../../../types';
// import IBridgehubABI from '../../../internal/abis/json/IBridgehub.json' assert { type: 'json' };
// import IERC20ABI from '../../../internal/abis/json/IERC20.json' assert { type: 'json' };
// import IL1NullifierABI from '../../../internal/abis/json/IL1Nullifier.json' assert { type: 'json' };
// import IL2AssetRouterABI from '../../../internal/abis/json/IL2AssetRouter.json' assert { type: 'json' };
import { IL1NativeTokenVault } from '../typechain';

/**
 * The address of the L1 `ETH` token.
 * @readonly
 */
export const ETH_ADDRESS: Address = '0x0000000000000000000000000000000000000000';

/**
 * The address of the L1 `ETH` token.
 * @readonly
 */
export const LEGACY_ETH_ADDRESS: Address = '0x0000000000000000000000000000000000000000';

/**
 * In the contracts the zero address can not be used, use one instead
 * @readonly
 */
export const ETH_ADDRESS_IN_CONTRACTS: Address = '0x0000000000000000000000000000000000000001';

/**
 * The address of the base token.
 * @readonly
 */
export const L2_BASE_TOKEN_ADDRESS = '0x000000000000000000000000000000000000800a';

export const L2_ASSET_ROUTER_ADDRESS: Address = '0x0000000000000000000000000000000000010003';

export const L2_NATIVE_TOKEN_VAULT_ADDRESS: Address = '0x0000000000000000000000000000000000010004';

export const L1_MESSENGER_ADDRESS = '0x0000000000000000000000000000000000008008' as const;

export const L2_BASE_TOKEN_SYSTEM_CONTRACT_ADDR =
  '0x000000000000000000000000000000000000800A' as const;

export const L2_ASSET_ROUTER_ADDR = '0x0000000000000000000000000000000000010003' as const;

export const L2_NATIVE_TOKEN_VAULT_ADDR = '0x0000000000000000000000000000000000010004' as const;

/**
 * Numerator used in scaling the gas limit to ensure acceptance of `L1->L2` transactions.
 *
 * This constant is part of a coefficient calculation to adjust the gas limit to account for variations
 * in the SDK estimation, ensuring the transaction will be accepted.
 *
 * @readonly
 */
export const L1_FEE_ESTIMATION_COEF_NUMERATOR = 12;

/**
 * Denominator used in scaling the gas limit to ensure acceptance of `L1->L2` transactions.
 *
 * This constant is part of a coefficient calculation to adjust the gas limit to account for variations
 * in the SDK estimation, ensuring the transaction will be accepted.
 *
 * @readonly
 */
export const L1_FEE_ESTIMATION_COEF_DENOMINATOR = 10;

/**
 * Gas limit used for displaying the error messages when the
 * users do not have enough fee when depositing ERC20 token from L1 to L2.
 *
 * @readonly
 */
export const L1_RECOMMENDED_MIN_ERC20_DEPOSIT_GAS_LIMIT = 1_000_000;

/**
 * Gas limit used for displaying the error messages when the
 * users do not have enough fee when depositing `ETH` token from L1 to L2.
 *
 * @readonly
 */
export const L1_RECOMMENDED_MIN_ETH_DEPOSIT_GAS_LIMIT = 200_000;

/**
 * The `L1->L2` transactions are required to have the following gas per pubdata byte.
 *
 * @readonly
 */
export const REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT = 800;

/**
 * Returns true if token represents ETH on L1 or L2.
 *
 * @param token The token address.
 *
 * @example
 *
 * import { utils } from "zksync-ethers";
 *
 * const isL1ETH = utils.isETH(utils.ETH_ADDRESS); // true
 * const isL2ETH = utils.isETH(utils.ETH_ADDRESS_IN_CONTRACTS); // true
 */
export function isETH(token: Address) {
  return (
    isAddressEq(token, LEGACY_ETH_ADDRESS) ||
    isAddressEq(token, L2_BASE_TOKEN_ADDRESS) ||
    isAddressEq(token, ETH_ADDRESS_IN_CONTRACTS)
  );
}

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

// export async function resolveFeeData(
//   tx: TransactionLike,
//   provider: Provider,
//   providerL2?: Provider,
// ): Promise<{
//   gasLimit: BigNumberish;
//   gasPrice: BigNumberish;
//   gasPerPubdata: BigNumberish | undefined;
// }> {
//   // Race all requests against each other so that ethers batches them if it can
//   return await resolveProperties({
//     gasLimit: (async () => tx.gasLimit ?? (await provider.estimateGas(tx)))(),
//     gasPrice: (async () =>
//       // eslint-disable-next-line @typescript-eslint/no-unsafe-return
//       tx.gasPrice ?? tx.maxFeePerGas ?? (await provider.getGasPrice()))(),
//     gasPerPubdata: (() => {
//       if (tx.type === null || tx.type === undefined) {
//         return REQUIRED_L1_TO_L2_GAS_PER_PUBDATA_LIMIT;
//       }
//       return undefined;
//     })(),
//   });
// }

/**
 * Compares stringified addresses, taking into account the fact that
 * addresses might be represented in different casing.
 *
 * @param a - The first address to compare.
 * @param b - The second address to compare.
 * @returns A boolean indicating whether the addresses are equal.
 *
 * @example
 *
 * import { utils } from "zksync-ethers";
 *
 * const address1 = "0x36615Cf349d7F6344891B1e7CA7C72883F5dc049";
 * const address2 = "0x36615cf349d7f6344891b1e7ca7c72883f5dc049";
 * const isEqual = utils.isAddressEq(address1, address2);
 * // true
 */
export function isAddressEq(a: Address, b: Address): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

// export async function getNullifierAddress(opts: {
//   l1: any; // L1 JsonRpcProvider
//   l2: any; // L2 JsonRpcProvider
//   l2Bridgehub: Address; // **L2** Bridgehub address (must expose assetRouter() on L2)
// }) {
//   const { l1, l2, l2Bridgehub } = opts;

//   // 1) L2 Bridgehub -> L2 Asset Router
//   const bhL2 = new Contract(l2Bridgehub, IBridgehubAbi, l1);
//   const l1AssetRouter = await bhL2.sharedBridge();
//   console.log('L2 ASSET ROUTER', l1AssetRouter);
//   // 2) L2 Asset Router -> L1 Asset Router
//   //const arL2 = new Contract(l2AssetRouter, L2AssetRouterAbi, l2);
//   //const l1AssetRouter = (await arL2.l1Bridge()) as Address;

//   // 3) Sanity: make sure L1 Asset Router is real on your L1 provider
//   // await requireCode(l1, l1AssetRouter, "L1 AssetRouter");

//   // 4) L1 Asset Router -> L1 Nullifier (immutable/public)
//   const arL1 = new Contract(l1AssetRouter, IL1AssetRouterAbi, l1);
//   const nullifier = (await arL1.L1_NULLIFIER()) as Address;
//   console.log('NULLIFIER', nullifier);
//   // 5) Sanity: ensure Nullifier exists on L1
//   //await requireCode(l1, nullifier, "L1 Nullifier");

//   return {
//     l1AssetRouter,
//     nullifier,
//   };
// }
