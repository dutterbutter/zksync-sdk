// packages/ethers/src/actions/transfers.ts
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

/* -------------------------------------------------------------------------- */
/*  Internal helper                                                           */
/* -------------------------------------------------------------------------- */

/** Builds a single-item bundle, merging caller-supplied MessageOptions. */
function asBundle(
  base   : Omit<BundleInput, 'items'>,
  items  : BundleInput['items'],
  reg    : ChainRegistry | undefined,
): BundleInput & { registry: ChainRegistry } {
  return {
    registry: reg ?? defaultRegistry,
    ...base,
    items,
  };
}

/* -------------------------------------------------------------------------- */
/*  Actions                                                                   */
/* -------------------------------------------------------------------------- */

/** Transfer native ETH (wrapped in a 1-call bundle). */
export async function sendNative(
  signer : Signer,
  input  : NativeTransferInput & { registry?: ChainRegistry },
): Promise<SentMessage> {

  if (!signer.provider) {
    // keep it simple: throw a *plain* Error – sendBundle will convert to InteropError
    throw new Error('PROVIDER_UNAVAILABLE: signer has no provider attached');
  }

  const txBundle = asBundle(
    input,
    [ bundle.native({ to: input.to, amount: input.amount }) ],
    input.registry,
  );

  return sendBundle(signer, txBundle);
}

/** Transfer an ERC-20 token (auto-approve when `approveIfNeeded` is true). */
export async function sendERC20(
  signer : Signer,
  input  : ERC20TransferInput & { registry?: ChainRegistry },
): Promise<SentMessage> {

  if (!signer.provider) {
    throw new Error('PROVIDER_UNAVAILABLE: signer has no provider attached');
  }

  const txBundle = asBundle(
    input,
    [ bundle.erc20({
        token : input.token,
        to    : input.to,
        amount: input.amount,
        approveIfNeeded: input.approveIfNeeded,
      }) ],
    input.registry,
  );

  return sendBundle(signer, txBundle);
}
