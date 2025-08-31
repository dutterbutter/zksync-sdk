// src/adapters/ethers/resources/l2-wait.ts
import type { Log } from 'ethers';
import { AbiCoder } from 'ethers';
import type { Hex } from '../../../../types/primitives';

const coder = AbiCoder.defaultAbiCoder();

// Known topics
const LEGACY_MAILBOX_NEW_PRIORITY =
  '0x1cd02155ad1064c60598a8bd0e4e795d7e7d0a0f3c38aad04d261f1297fb2545';
const BRIDGEHUB_NEW_PRIORITY = '0x0f87e1ea5eb1f034a6071ef630c174063e3d48756f853efaaf4292b929298240';

// **Canonical** L2 tx hash markers (prefer these)
const TOPIC_CANONICAL_ASSIGNED =
  '0x779f441679936c5441b671969f37400b8c3ed0071cb47444431bf985754560df'; // canonical hash in topics[2]
const TOPIC_CANONICAL_SUCCESS =
  '0xe4def01b981193a97a9e81230d7b9f31812ceaf23f864a828a82c687911cb2df'; // canonical hash in topics[3]

function isHash(x?: string): x is Hex {
  return !!x && x.startsWith('0x') && x.length === 66;
}

/**
 * Extract the **canonical** L2 tx hash from L1 logs.
 * Returns the first canonical hash it finds, plus optional chainId/txId for debugging.
 */
export function tryExtractL2TxHashFromLogs(
  logs: ReadonlyArray<Log>,
): { l2Hash: Hex; chainId?: bigint; txId?: bigint } | null {
  // 1) Prefer canonical-hash markers
  for (const log of logs) {
    const t0 = log.topics?.[0]?.toLowerCase();
    if (!t0) continue;

    // Canonical hash assigned: topics[2] is the hash
    if (t0 === TOPIC_CANONICAL_ASSIGNED) {
      const l2Hash = log.topics?.[2];
      if (isHash(l2Hash)) return { l2Hash: l2Hash as Hex };
    }

    // Marked successful: topics[3] is the canonical hash
    if (t0 === TOPIC_CANONICAL_SUCCESS) {
      const l2Hash = log.topics?.[3];
      if (isHash(l2Hash)) return { l2Hash: l2Hash as Hex };
    }
  }

  // 2) Fallbacks (less reliable in this OS build)
  for (const log of logs) {
    const t0 = log.topics?.[0]?.toLowerCase();
    if (!t0) continue;

    // Legacy Mailbox: we *used* to take topics[2], but it’s not the canonical hash here.
    // Keep as a last resort for other deployments.
    if (t0 === LEGACY_MAILBOX_NEW_PRIORITY) {
      console.log('DONT WANT TO BE HERE!');
      const chainId = log.topics?.[1] ? BigInt(log.topics[1]) : undefined;
      const candidate = log.topics?.[2];
      if (isHash(candidate)) {
        // Decode optional txId from data tail
        let txId: bigint | undefined;
        try {
          if (log.data && log.data.length >= 2 + 64 * 4) {
            const [id] = coder.decode(['uint256', 'uint256', 'uint256', 'bytes'], log.data);
            txId = BigInt(id);
          }
        } catch {}
        return { l2Hash: candidate as Hex, chainId, txId };
      }
    }

    // Bridgehub flavor: first 32 bytes of data looked like a hash but
    // in this OS build it is **not** the canonical L2 tx hash.
    if (t0 === BRIDGEHUB_NEW_PRIORITY) {
      console.log('DO NOT WANT TO BE HERE EITHER');
      if (log.data && log.data.length >= 2 + 64) {
        const chainId = log.topics?.[1] ? BigInt(log.topics[1]) : undefined;

        // Still expose it as a fallback (for other networks),
        // but it will *not* be used if canonical markers were found.
        const word0 = ('0x' + log.data.slice(2, 2 + 64)) as Hex;

        let txId: bigint | undefined;
        try {
          const rest = '0x' + log.data.slice(2 + 64);
          const [id] = coder.decode(['uint256', 'uint256', 'uint256', 'bytes'], rest);
          txId = BigInt(id);
        } catch {}

        if (isHash(word0)) return { l2Hash: word0, chainId, txId };
      }
    }
  }

  return null;
}
