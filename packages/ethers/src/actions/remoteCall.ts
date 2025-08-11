import type { RemoteCallInput, SentMessage, ChainRegistry, Hex } from '@zksync-sdk/core';

import {
  ATTR,
  encodeEvmV1,
  mergeAttributes,
  parseSendIdFromLogs,
  defaultRegistry,
} from '@zksync-sdk/core';

import type { Signer } from 'ethers';
import { Center } from '../internal/abi';
import { resolveChain } from '../internal/chain';
import { fromEthersError as _fromEthersError } from '../internal/errors';
import type { InteropError } from '@zksync-sdk/core';

const fromEthersError: (e: unknown, ctx?: string) => InteropError = _fromEthersError;

/**
 * Cconvenient method that wraps a single `sendMessage` on the InteropCenter.
 *
 * ```ts
 * const receipt = await remoteCall(signer, {
 *   src : Chains.era,
 *   dest: Chains.abs,
 *   to  : TARGET,
 *   data: ENCODED_FUNC_CALL,
 *   value: 0n               // optional – adds ATTR.interopCallValue when >0
 * });
 * ```
 */
export async function remoteCall(
  signer: Signer,
  input: RemoteCallInput & { registry?: ChainRegistry; allowMissingSendId?: boolean },
): Promise<SentMessage> {
  try {
    /* ---------------- pre-checks ---------------- */
    if (!signer.provider) {
      throw new Error('PROVIDER_UNAVAILABLE: signer has no provider');
    }

    const reg = input.registry ?? defaultRegistry;
    const src = resolveChain(reg, input.src!);
    const dest = resolveChain(reg, input.dest!);

    /* ---------------- encode ---------------- */
    const extraAttrs = input.value && input.value > 0n ? [ATTR.interopCallValue(input.value)] : [];
    const attributes = mergeAttributes(input.attributes, extraAttrs);
    const data = Center.encodeFunctionData('sendMessage', [
      encodeEvmV1(BigInt(dest.chainId), input.to),
      input.data,
      attributes,
    ]);

    /* ---------------- send ---------------- */
    const tx = await signer.sendTransaction({
      to: src.addresses.interopCenter,
      data,
      value: input.value ?? 0n,
    });

    const rc = await tx.wait();
    if (!rc) {
      throw new Error('SEND_FAILED: Transaction was dropped or not included');
    }

    /* ---------------- post-process ---------------- */
    const sendId = parseSendIdFromLogs(rc);

    if (!sendId && !input.allowMissingSendId) {
      throw new Error('SEND_FAILED: MessageSent sendId not found in receipt logs');
    }

    return { sendId: sendId ?? '0x', srcTxHash: tx.hash as Hex };
  } catch (err) {
    throw fromEthersError(err, 'remoteCall');
  }
}
