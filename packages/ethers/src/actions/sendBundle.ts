// packages/ethers/src/actions/sendBundle.ts
import type { BundleInput, ChainRegistry, SentMessage, Estimate, Hex } from '@zksync-sdk/core';

import {
  encodeEvmV1ChainOnly,
  toCallStarter,
  parseBundleHashFromLogs,
  parseSendIdFromLogs,
  defaultRegistry,
  InteropError,
  computeBundleMessageValue,
} from '@zksync-sdk/core';

import type { Signer, TransactionReceipt, TransactionRequest, Provider } from 'ethers';
import { keccak256, AbiCoder } from 'ethers';

import { Center } from '../internal/abi';
import { resolveChain } from '../internal/chain';
import { fromEthersError } from '../internal/errors';

/**
 * Send an Interop bundle with an Ethers v6 Signer.
 *
 * @param signer   – Ethers signer (must have a provider attached)
 * @param input    – Bundle + optional registry / gas overrides
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

  /* ───────────────────── send + wait ─────────────────────────── */

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
export function estimateBundle(
  _provider: Provider,
  input: BundleInput & { registry: ChainRegistry },
): Promise<Estimate> {
  const base = 400_000n;
  const perItem = 80_000n * BigInt(input.items.length);
  return Promise.resolve({ gasLimit: ((base + perItem) * 13n) / 10n, notes: ['heuristic'] });
}
