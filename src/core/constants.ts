// core/constants.ts

import type { Address, Hex } from './types/primitives';
import { k256hex } from './utils/addr';

// -----------------------------------------------------------------------------
// Addresses (system / core)
// -----------------------------------------------------------------------------

/** The formal zero address used to represent ETH on L1. */
export const FORMAL_ETH_ADDRESS = '0x0000000000000000000000000000000000000000' satisfies Address;

/** Some contracts disallow the zero address; use 0x…01 as a stand-in when needed. */
export const ETH_ADDRESS = '0x0000000000000000000000000000000000000001' satisfies Address;

/** L2 Asset Router contract address. */
export const L2_ASSET_ROUTER_ADDRESS =
  '0x0000000000000000000000000000000000010003' satisfies Address;

/** L2 Native Token Vault contract address. */
export const L2_NATIVE_TOKEN_VAULT_ADDRESS =
  '0x0000000000000000000000000000000000010004' satisfies Address;

/** L1 Messenger contract address. */
export const L1_MESSENGER_ADDRESS = '0x0000000000000000000000000000000000008008' as const;

/** L2 Base Token System contract address. */
export const L2_BASE_TOKEN_ADDRESS = '0x000000000000000000000000000000000000800A' as const;

/** L1 token address (SOPH). */
export const L1_SOPH_TOKEN_ADDRESS = '0xa9544a49d4aEa4c8E074431c89C79fA9592049d8' as const;

// -----------------------------------------------------------------------------
// Event topics
// -----------------------------------------------------------------------------

/** New-format L1MessageSent(topic) signature: L1MessageSent(uint256,bytes32,bytes) */
export const TOPIC_L1_MESSAGE_SENT_NEW: Hex = k256hex('L1MessageSent(uint256,bytes32,bytes)');

/** Legacy-format L1MessageSent(topic) signature: L1MessageSent(address,bytes32,bytes) */
export const TOPIC_L1_MESSAGE_SENT_LEG: Hex = k256hex('L1MessageSent(address,bytes32,bytes)');

/** Optional canonical markers. */
export const TOPIC_CANONICAL_ASSIGNED: Hex =
  '0x779f441679936c5441b671969f37400b8c3ed0071cb47444431bf985754560df';

/** Optional canonical success marker. */
export const TOPIC_CANONICAL_SUCCESS: Hex =
  '0xe4def01b981193a97a9e81230d7b9f31812ceaf23f864a828a82c687911cb2df';

// -----------------------------------------------------------------------------
// L1->L2 fee estimation scaling
// -----------------------------------------------------------------------------

/**
 * Numerator used in scaling the gas limit to help ensure acceptance of L1->L2 txs.
 * Used with {@link L1_FEE_ESTIMATION_COEF_DENOMINATOR}.
 */
export const L1_FEE_ESTIMATION_COEF_NUMERATOR = 12;

/**
 * Denominator used in scaling the gas limit to help ensure acceptance of L1->L2 txs.
 * Used with {@link L1_FEE_ESTIMATION_COEF_NUMERATOR}.
 */
export const L1_FEE_ESTIMATION_COEF_DENOMINATOR = 10;
