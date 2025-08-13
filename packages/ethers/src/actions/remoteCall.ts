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
 * Perform a single cross-chain call using `InteropCenter.sendMessage` (no bundling).
 *
 * @param signer                Signer bound to the source chain provider.
 * @param input
 * @param input.src             Source chain identifier (registry key or chainId).
 * @param input.dest            Destination chain identifier.
 * @param input.to              Target contract address on destination chain.
 * @param input.data            ABI-encoded calldata for the target.
 * @param input.value           Optional interop call value (adds ATTR.interopCallValue when > 0).
 * @param input.attributes      Optional ERC-7786 attributes to merge with `value`.
 * @param input.registry        Optional registry override (defaults to {@link defaultRegistry}).
 * @param input.allowMissingSendId  If true, do not error when sendId is not found in logs.
 * @returns                     {@link SentMessage} containing `sendId` and `srcTxHash`.
 * @throws                      If signer has no provider or send fails.
 *
 * @remarks
 * - Recipient is encoded as ERC-7930 EVM (chain + address).
 * - Base-token rules apply to `msg.value`: SAME base → `value`; DIFFERENT → `0`.
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
