import type {
  ChainRegistry,
  NativeTransferInput,
  ERC20TransferInput,
  BundleInput,
  SentMessage,
} from '@zksync-sdk/core';

import { bundle, defaultRegistry } from '@zksync-sdk/core';
import type { Signer } from 'ethers';
import { sendBundle } from './sendBundle';

import { ensureAllowance } from '../internal/allowance';
import { resolveChain } from '../internal/chain';
import { ensureRegisteredInNTV } from '../internal/register';

/* -------------------------------------------------------------------------- */
/*  Helper – build a single-item bundle                                       */
/* -------------------------------------------------------------------------- */
/**
 * Promote a single item into a full {@link BundleInput}, normalizing the registry.
 *
 * @param base  Base bundle fields (e.g. `src`, `dest`, `attributes`, `gas`, `nonce`).
 * @param items One or more bundle items to send.
 * @param reg   Optional chain registry; falls back to {@link defaultRegistry}.
 * @returns     A complete {@link BundleInput} with `items` and a concrete `registry`.
 */
function asBundle(
  base: Omit<BundleInput, 'items'>,
  items: BundleInput['items'],
  reg: ChainRegistry | undefined,
): BundleInput & { registry: ChainRegistry } {
  return {
    registry: reg ?? defaultRegistry,
    ...base,
    items,
  };
}

/* -------------------------------------------------------------------------- */
/*  Native ETH transfer                                                       */
/* -------------------------------------------------------------------------- */
/**
 * Send native ETH from `src` to `dest` as a single-item interop bundle.
 *
 * @param signer            Signer bound to the source chain provider.
 * @param input
 * @param input.src         Source chain identifier (registry key or chainId).
 * @param input.dest        Destination chain identifier.
 * @param input.to          Recipient address on destination chain.
 * @param input.amount      Amount of native token to transfer.
 * @param input.registry    Optional registry override (defaults to {@link defaultRegistry}).
 * @returns                 {@link SentMessage} containing `sendId` and `srcTxHash`.
 * @throws                  If no provider is attached to the signer.
 *
 * @remarks
 * - Contracts require `msg.value == amount` when source/dest share the same base token,
 *   and `msg.value == 0` when they differ. This helper defers value handling to `sendBundle`.
 */
export async function sendNative(
  signer: Signer,
  input: NativeTransferInput & { registry?: ChainRegistry },
): Promise<SentMessage> {
  if (!signer.provider) throw new Error('PROVIDER_UNAVAILABLE: signer has no provider');

  const txBundle = asBundle(
    input,
    [bundle.native({ to: input.to, amount: input.amount })],
    input.registry,
  );

  return sendBundle(signer, txBundle);
}

/* -------------------------------------------------------------------------- */
/*  ERC-20 transfer (direct or indirect)                                      */
/* -------------------------------------------------------------------------- */
/**
 * Send ERC-20 from `src` to `dest` as a single-item interop bundle.
 *
 * @param signer                Signer bound to the source chain provider.
 * @param input
 * @param input.src             Source chain identifier (registry key or chainId).
 * @param input.dest            Destination chain identifier.
 * @param input.token           ERC-20 token address (source chain).
 * @param input.to              Recipient address on destination chain.
 * @param input.amount          Token amount to transfer.
 * @param input.indirect        If true, route via AssetRouter/NTV (burn/deposit).
 * @param input.bridgeMsgValue  ETH to send with the indirect bridging message (only when `indirect`).
 * @param input.approveIfNeeded If true (default), auto-approve NTV for `amount` on first use.
 * @param input.registry        Optional registry override (defaults to {@link defaultRegistry}).
 * @returns                     {@link SentMessage} containing `sendId` and `srcTxHash`.
 * @throws                      If signer has no provider, or NTV address is missing for indirect path.
 *
 * @remarks
 * - **Indirect**: ensures token registration in NTV and sufficient allowance before sending.
 * - Do **not** set interop call value for indirect; contracts derive/validate it internally.
 * - Base-token `msg.value` rules are enforced by `sendBundle` (see its notes).
 */
export async function sendERC20(
  signer: Signer,
  input: ERC20TransferInput & { registry?: ChainRegistry },
): Promise<SentMessage> {
  if (!signer.provider) throw new Error('PROVIDER_UNAVAILABLE: signer has no provider');

  const reg = input.registry ?? defaultRegistry;
  const src = resolveChain(reg, input.src!);
  const ntv = src.addresses.nativeTokenVault;

  if (input.indirect) {
    if (!ntv) throw new Error('CONFIG_MISSING: nativeTokenVault address not set for source chain');

    // ensure token is registered
    await ensureRegisteredInNTV(signer, ntv, input.token);

    // ensure allowance is set
    if (input.approveIfNeeded ?? true) {
      await ensureAllowance(signer, input.token, ntv, input.amount);
    }
  }

  const item = bundle.erc20({
    token: input.token,
    to: input.to,
    amount: input.amount,
    indirect: input.indirect,
    bridgeMsgValue: input.bridgeMsgValue,
    approveIfNeeded: input.approveIfNeeded,
  });

  const txBundle = asBundle(input, [item], input.registry);
  return sendBundle(signer, txBundle);
}
