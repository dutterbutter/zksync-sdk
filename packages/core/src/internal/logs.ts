// packages/core/src/internal/logs.ts
import { bytesToHex } from './hex';
import type { Hex } from './hex';
import { keccak_256 } from '@noble/hashes/sha3';

// TODO: refactor

export interface LogLike {
  topics?: readonly unknown[];
  data?: unknown;
}

const MSG_SENT_SIG = 'MessageSent(bytes32,bytes,bytes,bytes,uint256,bytes[])';
const BUNDLE_SENT_SIG =
  'InteropBundleSent(bytes32,bytes32,(uint256,uint256,bytes32,(address,bytes,bytes,uint256,bool)[],(bytes,bytes)))';

export const MESSAGE_SENT_TOPIC0: Hex = (() => {
  const h = keccak_256(new TextEncoder().encode(MSG_SENT_SIG));
  return `0x${bytesToHex(h).slice(2)}`;
})();

export const INTEROP_BUNDLE_SENT_TOPIC0: Hex = (() => {
  const h = keccak_256(new TextEncoder().encode(BUNDLE_SENT_SIG));
  return `0x${bytesToHex(h).slice(2)}`;
})();

/* -------------------------------------------------------------------------- */
/*  helpers                                                                   */
/* -------------------------------------------------------------------------- */

type LogsContainer = { logs?: unknown };

function isLogLike(x: unknown): x is LogLike {
  if (typeof x !== 'object' || x === null) return false;
  // topics can be absent or an array; we don’t care about .data
  const maybeTopics = (x as { topics?: unknown }).topics;
  return maybeTopics === undefined || Array.isArray(maybeTopics);
}

function isLogLikeArray(x: unknown): x is readonly LogLike[] {
  return Array.isArray(x) && x.every(isLogLike);
}

function isLogsContainer(x: unknown): x is LogsContainer {
  return typeof x === 'object' && x !== null && 'logs' in (x as Record<string, unknown>);
}

function getLogs(
  input: { logs?: readonly LogLike[] } | readonly LogLike[] | null | undefined,
): readonly LogLike[] {
  if (isLogLikeArray(input)) return input;
  if (isLogsContainer(input) && isLogLikeArray((input as LogsContainer).logs)) {
    return (input as { logs: readonly LogLike[] }).logs;
  }
  return [];
}

function topic0Lower(topics: readonly unknown[] | undefined): string | undefined {
  const t0 = topics?.[0];
  return typeof t0 === 'string' ? t0.toLowerCase() : undefined;
}

function isHexString(v: unknown): v is Hex {
  return typeof v === 'string' && v.startsWith('0x');
}

/* -------------------------------------------------------------------------- */
/*  parsers                                                                   */
/* -------------------------------------------------------------------------- */

export function parseSendIdFromLogs(
  input: { logs?: readonly LogLike[] } | readonly LogLike[] | null | undefined,
): Hex | undefined {
  const logs = getLogs(input);

  // strict: match MessageSent signature
  for (const l of logs) {
    const topics = Array.isArray(l.topics) ? (l.topics as readonly unknown[]) : undefined;
    if (topics && topics.length >= 2 && topic0Lower(topics) === MESSAGE_SENT_TOPIC0.toLowerCase()) {
      const id = topics[1];
      if (isHexString(id)) return id;
    }
  }

  // relaxed fallback: any second topic that looks like a hex id
  for (const l of logs) {
    const topics = Array.isArray(l.topics) ? (l.topics as readonly unknown[]) : undefined;
    if (topics && topics.length >= 2) {
      const id = topics[1];
      if (isHexString(id)) return id;
    }
  }
  return undefined;
}

/** Extract bundleHash from InteropBundleSent(bundleHash indexed?, …) */
export function parseBundleHashFromLogs(
  input: { logs?: readonly LogLike[] } | readonly LogLike[] | null | undefined,
): Hex | undefined {
  const logs = getLogs(input);

  for (const l of logs) {
    const topics = Array.isArray(l.topics) ? (l.topics as readonly unknown[]) : undefined;
    if (
      topics &&
      topics.length >= 2 &&
      topic0Lower(topics) === INTEROP_BUNDLE_SENT_TOPIC0.toLowerCase()
    ) {
      const bundleHash = topics[1];
      if (isHexString(bundleHash)) return bundleHash;
    }
  }
  return undefined;
}
