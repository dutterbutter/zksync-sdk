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

/* -------------------------------------------------------------------------- */
/*  Helper – build a single-item bundle                                       */
/* -------------------------------------------------------------------------- */
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
export async function sendERC20(
  signer: Signer,
  input: ERC20TransferInput & { registry?: ChainRegistry },
): Promise<SentMessage> {
  if (!signer.provider) throw new Error('PROVIDER_UNAVAILABLE: signer has no provider');

  /* -------- 1.  Allowance on the source chain ------------------- */
  if (input.approveIfNeeded ?? true) {
    const reg = input.registry ?? defaultRegistry;
    const src = resolveChain(reg, input.src!);
    const ntv = src.addresses.nativeTokenVault;

    // TODO: remove adding addresses to chaininfo
    if (!ntv) throw new Error('CONFIG_MISSING: nativeTokenVault address not set for source chain');

    await ensureAllowance(signer, input.token, ntv, input.amount);
  }

  /* -------- 2.  Build bundle item --------------------------------------- */
  const item = bundle.erc20({
    token: input.token,
    to: input.to,
    amount: input.amount,
    indirect: input.indirect,
    bridgeMsgValue: input.bridgeMsgValue,
    approveIfNeeded: input.approveIfNeeded,
  });

  /* -------- 3.  Wrap in a bundle & send --------------------------------- */
  const txBundle = asBundle(input, [item], input.registry);
  return sendBundle(signer, txBundle);
}
