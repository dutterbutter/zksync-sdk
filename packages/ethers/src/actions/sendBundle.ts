// packages/ethers/src/actions/sendBundle.ts
import type { BundleInput, ChainRegistry, SentMessage, Hex } from '@zksync-sdk/core';

import {
  encodeEvmV1ChainOnly,
  toCallStarter,
  parseBundleHashFromLogs,
  parseSendIdFromLogs,
  defaultRegistry,
  InteropError,
  computeBundleMessageValue,
} from '@zksync-sdk/core';

import type { Signer, TransactionReceipt, TransactionRequest } from 'ethers';
import { keccak256, AbiCoder } from 'ethers';

import { Center } from '../internal/abi';
import { resolveChain } from '../internal/chain';
import { fromEthersError } from '../internal/errors';

/**
 * Send a multi-item interop bundle via InteropCenter.
 *
 * @param signer                 Signer bound to the source chain provider.
 * @param input                  Bundle payload and optional registry/gas overrides.
 * @param input.src              Source chain identifier (registry key or chainId).
 * @param input.dest             Destination chain identifier.
 * @param input.items            Array of bundle items (remote calls, native/erc20 transfers).
 * @param input.attributes       Optional ERC-7786 bundle attributes (e.g., execution/unbundler).
 * @param input.gas              Optional gas overrides (EIP-1559 fields, gasLimit).
 * @param input.nonce            Optional tx nonce override.
 * @param input.registry         Optional registry override (defaults to {@link defaultRegistry}).
 * @param input.allowMissingSendId  If true, do not error when sendId is not found in logs.
 * @returns                      {@link SentMessage} containing `sendId` and `srcTxHash`.
 * @throws                        If signer has no provider, misconfiguration, or send fails.
 *
 * @remarks
 * - Destination is encoded as ERC-7930 “chain-only” address; per-item `to` uses “address-only”.
 * - `msg.value` must follow base-token rules:
 *   SAME base token → sum of item values; DIFFERENT → 0 (InteropCenter deposits via AssetRouter).
 *   This implementation currently uses the sum; add a base-token check if heterogeneous pairs are common.
 * - `sendId` is read from ERC-7786 `MessageSent` logs; for single-item bundles we fall back to
 *   `keccak256(abi.encode(bundleHash, 0))` when logs are unavailable.
 */
export async function sendBundle(
  signer: Signer,
  input: BundleInput & {
    registry?: ChainRegistry;
    allowMissingSendId?: boolean;
  },
): Promise<SentMessage> {
  /* ───────────────────── pre-flight checks ────────────────────── */
  const provider = signer.provider;
  if (!provider) {
    throw new InteropError('PROVIDER_UNAVAILABLE', 'sendBundle: signer has no provider attached', {
      signer,
    });
  }

  const registry = input.registry ?? defaultRegistry;

  if (input.src === undefined || input.dest === undefined) {
    throw new InteropError('CONFIG_MISSING', 'sendBundle: both src and dest must be provided', {
      input,
    });
  }

  const src = resolveChain(registry, input.src);
  const dest = resolveChain(registry, input.dest);

  /* Network consistency check (warn only) */
  (async () => {
    try {
      const net = await provider.getNetwork();
      if (Number(net.chainId) !== Number(src.chainId)) {
        process.emitWarning(
          `[zksync-sdk/ethers] signer is on chain ${net.chainId} but “src” is ${src.chainId}`,
          { code: 'CHAIN_MISMATCH' },
        );
      }
    } catch {
      /* ignore */
    }
  })().catch(() => {
    /* fire-and-forget */
  });

  /* ───────────────────── encode call data ────────────────────── */
  const starters = input.items
    .map((it) => toCallStarter(it, { assetRouter: src.addresses.assetRouter }))
    .map(({ starter }) => starter);
  const bundleArgs = (input.attributes ?? []).map((a) => a.data);
  const encodedDst = encodeEvmV1ChainOnly(BigInt(dest.chainId));

  const data = Center.encodeFunctionData('sendBundle', [encodedDst, starters, bundleArgs]);
  const value = computeBundleMessageValue(input.items);

  /* ───────────────────── build tx request ────────────────────── */

  const txReq: TransactionRequest = {
    to: src.addresses.interopCenter,
    data,
    value,
    // copy explicit overrides if any
    gasLimit: input.gas?.gasLimit,
    maxFeePerGas: input.gas?.maxFeePerGas,
    maxPriorityFeePerGas: input.gas?.maxPriorityFeePerGas,
    nonce: input.nonce !== undefined ? Number(input.nonce) : undefined,
  };

  /* ───────────────────── send ─────────────────────────── */

  let receipt: TransactionReceipt;
  try {
    const tx = await signer.sendTransaction(txReq);
    const maybeReceipt = await tx.wait();
    if (maybeReceipt === null) {
      throw new InteropError('SEND_FAILED', 'sendBundle: transaction receipt not found', {
        txHash: tx.hash,
      });
    }
    receipt = maybeReceipt;
  } catch (e) {
    throw fromEthersError(e, 'sendBundle');
  }

  /* ───────────────────── post-processing ─────────────────────── */

  let sendId = parseSendIdFromLogs(receipt);

  // If single-item bundle and no MessageSent found, derive from bundleHash
  if (!sendId && input.items.length === 1) {
    const bundleHash = parseBundleHashFromLogs(receipt);
    if (bundleHash) {
      // sendId = keccak256(abi.encodePacked(bundleHash, uint256(0)))
      const abi = new AbiCoder();
      const packed = abi.encode(['bytes32', 'uint256'], [bundleHash, 0]);
      sendId = keccak256(packed) as `0x${string}`;
    }
  }

  if (!sendId && !input.allowMissingSendId) {
    throw new InteropError(
      'SEND_FAILED',
      'sendBundle: MessageSent sendId not found in receipt logs',
      { receiptHash: receipt.hash },
    );
  }

  return {
    sendId: sendId ?? '0x',
    srcTxHash: receipt.hash as Hex,
  };
}

// TODO: estimation
// export function estimateBundle(
//   _provider: Provider,
//   input: BundleInput & { registry: ChainRegistry },
// ): Promise<Estimate> {

//   // TODO
// }
