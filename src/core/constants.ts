import { keccak256, toUtf8Bytes } from 'ethers';
import type { Address } from './types/primitives';
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

/**
 * The address of the L1 messenger contract.
 * @readonly
 */
export const L2_ASSET_ROUTER_ADDRESS: Address = '0x0000000000000000000000000000000000010003';

/**
 * The address of the L2 Native Token Vault contract.
 * @readonly
 */
export const L2_NATIVE_TOKEN_VAULT_ADDRESS: Address = '0x0000000000000000000000000000000000010004';

/** The address of the L1 messenger contract.
 * @readonly
 */
export const L1_MESSENGER_ADDRESS = '0x0000000000000000000000000000000000008008' as const;

/** The address of the L2 Base Token System contract.
 * @readonly
 */
export const L2_BASE_TOKEN_SYSTEM_CONTRACT_ADDR =
  '0x000000000000000000000000000000000000800A' as const;

/**
 * The address of the L2 Asset Router contract.
 * @readonly
 */
export const L2_ASSET_ROUTER_ADDR = '0x0000000000000000000000000000000000010003' as const;

/**
 * The address of the L2 Native Token Vault contract.
 * @readonly
 */
export const L2_NATIVE_TOKEN_VAULT_ADDR = '0x0000000000000000000000000000000000010004' as const;

// topic0 for L1MessageSent(address,bytes32,bytes)
export const TOPIC_L1_MESSAGE_SENT =
  '0x2632cc0d58b0cb1017b99cc0b6cc66ad86440cc0dd923bfdaa294f95ba1b0201' as const;

// Support both OS flavors
export const TOPIC_L1_MESSAGE_SENT_NEW = keccak256(
  toUtf8Bytes('L1MessageSent(uint256,bytes32,bytes)'),
).toLowerCase();
export const TOPIC_L1_MESSAGE_SENT_LEG = keccak256(
  toUtf8Bytes('L1MessageSent(address,bytes32,bytes)'),
).toLowerCase();

// Bridgehub.NewPriorityRequest(chainId indexed, sender indexed, txHash bytes32, txId uint256, data bytes)
// topic hash (stable across adapters)
export const TOPIC_BRIDGEHUB_NEW_PRIORITY =
  '0x0f87e1ea5eb1f034a6071ef630c174063e3d48756f853efaaf4292b929298240';

// Optional canonical markers (some OS builds)
export const TOPIC_CANONICAL_ASSIGNED =
  '0x779f441679936c5441b671969f37400b8c3ed0071cb47444431bf985754560df'; // hash in topics[2]
export const TOPIC_CANONICAL_SUCCESS =
  '0xe4def01b981193a97a9e81230d7b9f31812ceaf23f864a828a82c687911cb2df'; // hash in topics[3]

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
