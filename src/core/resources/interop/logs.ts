// src/core/interop/logs.ts
import type { ParsedReceipt } from '../../types/flows/base';
import type { InteropStatus } from '../../types/flows/interop';
import type { Hex } from '../../types/primitives';
import {
  hasBundleVerified,
  hasBundleExecuted,
  hasBundleUnbundled,
  findBundleSentLog,
} from './events';
import type { InteropTopics } from './events';

/** Derive a coarse InteropStatus from known receipts (adapter can enrich) */
export function deriveStatusFromReceipts(args: {
  source?: ParsedReceipt; // L2 source receipt with InteropBundleSent
  destination?: ParsedReceipt; // dest L2 receipt with handler events
  topics: InteropTopics;
  hints?: { l1MsgHash?: string; bundleHash?: string; dstExecTxHash?: string };
}): InteropStatus {
  const { source, destination, topics, hints } = args;

  if (!source && !destination) return { phase: 'UNKNOWN' };

  // Start with SENT if we saw the bundle sent on source
  if (source) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const sent = findBundleSentLog(source, topics);
    // We treat presence of the event as SENT; adapter can fill hashes in handle
    const base: InteropStatus = {
      phase: 'SENT',
      l2SrcTxHash: source.transactionHash,
      l1MsgHash: hints?.l1MsgHash as Hex,
      bundleHash: hints?.bundleHash as Hex,
    };

    if (destination) {
      if (hasBundleExecuted(destination, topics)) {
        return { ...base, phase: 'EXECUTED', dstExecTxHash: hints?.dstExecTxHash as Hex };
      }
      if (hasBundleUnbundled(destination, topics)) {
        return { ...base, phase: 'UNBUNDLED', dstExecTxHash: hints?.dstExecTxHash as Hex };
      }
      if (hasBundleVerified(destination, topics)) {
        return { ...base, phase: 'VERIFIED' };
      }
    }
    return base;
  }

  // No source receipt but we do have destination evidence → at least VERIFIED/EXECUTED/UNBUNDLED
  if (destination) {
    if (hasBundleExecuted(destination, topics)) return { phase: 'EXECUTED' };
    if (hasBundleUnbundled(destination, topics)) return { phase: 'UNBUNDLED' };
    if (hasBundleVerified(destination, topics)) return { phase: 'VERIFIED' };
  }
  return { phase: 'UNKNOWN' };
}
