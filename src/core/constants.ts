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

export const L2_ASSET_ROUTER_ADDRESS: Address = '0x0000000000000000000000000000000000010003';

export const L2_NATIVE_TOKEN_VAULT_ADDRESS: Address = '0x0000000000000000000000000000000000010004';

export const L1_MESSENGER_ADDRESS = '0x0000000000000000000000000000000000008008' as const;

export const L2_BASE_TOKEN_SYSTEM_CONTRACT_ADDR =
  '0x000000000000000000000000000000000000800A' as const;

export const L2_ASSET_ROUTER_ADDR = '0x0000000000000000000000000000000000010003' as const;

export const L2_NATIVE_TOKEN_VAULT_ADDR = '0x0000000000000000000000000000000000010004' as const;

// topic0 for L1MessageSent(address,bytes32,bytes)
export const TOPIC_L1_MESSAGE_SENT =
  "0x2632cc0d58b0cb1017b99cc0b6cc66ad86440cc0dd923bfdaa294f95ba1b0201" as const;

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
