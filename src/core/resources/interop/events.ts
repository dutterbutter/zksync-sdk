// src/core/interop/events.ts
import type { ParsedLog, ParsedReceipt } from '../../types/flows/interop';

/** Event topics (declare names here; bind keccak values in constants.ts) */
export interface InteropTopics {
  InteropBundleSent: string;  // keccak256("InteropBundleSent(bytes32,bytes32,(...))")
  BundleVerified: string;     // keccak256("BundleVerified(bytes32)")
  BundleExecuted: string;     // keccak256("BundleExecuted(bytes32)")
  BundleUnbundled: string;    // keccak256("BundleUnbundled(bytes32)")
  CallProcessed?: string;     // optional; for granular per-call status
}

/** Finds the InteropBundleSent log in a source L2 receipt */
export function findBundleSentLog(
  receipt: ParsedReceipt,
  topics: InteropTopics,
  opts?: { index?: number; emitter?: string },
): ParsedLog {
  const index = opts?.index ?? 0;
  const topic0 = topics.InteropBundleSent.toLowerCase();
  const emitter = opts?.emitter?.toLowerCase();

  const hits = receipt.logs.filter((lg) => {
    const t0 = (lg.topics?.[0] ?? '').toLowerCase();
    if (t0 !== topic0) return false;
    if (emitter && (lg.address ?? '').toLowerCase() !== emitter) return false;
    return true;
  });

  if (!hits.length) throw new Error('No InteropBundleSent event found in receipt.');
  return hits[index] ?? hits[0];
}

/** True if a destination receipt contains a BundleVerified log */
export function hasBundleVerified(receipt: ParsedReceipt, topics: InteropTopics): boolean {
  const t0 = topics.BundleVerified.toLowerCase();
  return receipt.logs.some((lg) => (lg.topics?.[0] ?? '').toLowerCase() === t0);
}

/** True if a destination receipt contains a BundleExecuted log */
export function hasBundleExecuted(receipt: ParsedReceipt, topics: InteropTopics): boolean {
  const t0 = topics.BundleExecuted.toLowerCase();
  return receipt.logs.some((lg) => (lg.topics?.[0] ?? '').toLowerCase() === t0);
}

/** True if a destination receipt contains a BundleUnbundled log */
export function hasBundleUnbundled(receipt: ParsedReceipt, topics: InteropTopics): boolean {
  const t0 = topics.BundleUnbundled.toLowerCase();
  return receipt.logs.some((lg) => (lg.topics?.[0] ?? '').toLowerCase() === t0);
}
