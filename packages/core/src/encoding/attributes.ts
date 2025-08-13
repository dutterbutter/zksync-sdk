import { encodeFunctionData } from '../internal';

// ---- public API ----
const SIG = {
  interopCallValue: 'interopCallValue(uint256)',
  indirectCall: 'indirectCall(uint256)',
  executionAddress: 'executionAddress(bytes)',
  unbundlerAddress: 'unbundlerAddress(bytes)',
} as const;

/**
 * ERC-7786 attribute encoders used by InteropCenter/Handler.
 *
 * @remarks
 * - **Call-level**: {@link ATTR.interopCallValue}, {@link ATTR.indirectCall}.
 * - **Bundle-level**: {@link ATTR.executionAddress}, {@link ATTR.unbundlerAddress}.
 * - For 7930 parameters, prefer the helpers in `encoding/7930` to produce **chain-only**
 *   or **address-only** encodings as required by the contracts.
 */
export const ATTR = {
  /**
   * Set the value (base token) forwarded to the destination call.
   *
   * @param value Amount in wei.
   * @returns     ABI-encoded ERC-7786 attribute.
   *
   * @remarks
   * Include in the **call attributes** array for the target item.
   */
  interopCallValue: (value: bigint): `0x${string}` =>
    encodeFunctionData(SIG.interopCallValue, ['uint256'], [value]),

  /**
   * Mark a call as **indirect** (bridging path) and include message value for the bridge hop.
   *
   * @param bridgeMsgValue ETH sent with the IL2CrossChainSender message (wei).
   * @returns              ABI-encoded ERC-7786 attribute.
   *
   * @remarks
   * - Use only for the **AssetRouter/NTV** call starter in an indirect ERC-20 transfer.
   * - Do **not** combine with `interopCallValue` for the same call; the contracts derive/check it.
   */
  indirectCall: (bridgeMsgValue: bigint): `0x${string}` =>
    encodeFunctionData(SIG.indirectCall, ['uint256'], [bridgeMsgValue]),

  /**
   * Restrict who can execute the bundle on the destination.
   *
   * @param erc7930 ERC-7930 interoperable address (typically **address-only**).
   * @returns       ABI-encoded ERC-7786 attribute.
   *
   * @remarks
   * Include in the **bundle attributes** array. Omit for permissionless execution.
   */
  executionAddress: (erc7930: `0x${string}`): `0x${string}` =>
    encodeFunctionData(SIG.executionAddress, ['bytes'], [erc7930]),

  /**
   * Restrict who can unbundle/cancel individual calls on the destination.
   *
   * @param erc7930 ERC-7930 interoperable address (typically **address-only**).
   * @returns       ABI-encoded ERC-7786 attribute.
   *
   * @remarks
   * Include in the **bundle attributes** array. Omit to default to the original sender.
   */
  unbundlerAddress: (erc7930: `0x${string}`): `0x${string}` =>
    encodeFunctionData(SIG.unbundlerAddress, ['bytes'], [erc7930]),
} as const;
