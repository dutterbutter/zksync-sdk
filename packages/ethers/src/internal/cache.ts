import type { TransactionReceipt, Log } from 'ethers';
import { Center } from './abi';
import { id } from 'ethers';

type Hex = `0x${string}`;
const MESSAGE_SENT_TOPIC0 = id(
  'MessageSent(bytes32,bytes,bytes,bytes,uint256,bytes[])',
).toLowerCase();

export const bundleIndex = new Map<string, { bundleHash?: Hex; srcTxHash?: Hex }>();

export function indexFromReceipt(
  sendId: Hex | undefined,
  srcTxHash: Hex,
  receipt: TransactionReceipt,
): void {
  const logs: readonly Log[] = receipt.logs ?? [];
  let bundleHash: Hex | undefined;

  for (const log of logs) {
    try {
      const dec = Center.parseLog(log);
      if (dec?.name === 'InteropBundleSent') {
        bundleHash = dec.args.interopBundleHash as Hex;
        break;
      }
    } catch {
      // intentionally ignore errors from parsing logs
      // this can happen if the log is not from the expected contract
      // or if the log format has changed unexpectedly
      // we just skip this log and continue processing others
    }
  }

  if (sendId) {
    const key = sendId.toLowerCase();
    const prev = bundleIndex.get(key) ?? {};
    bundleIndex.set(key, {
      bundleHash: bundleHash ?? prev.bundleHash,
      srcTxHash: srcTxHash ?? prev.srcTxHash,
    });
  }

  if (bundleHash) {
    const ids: Hex[] = [];
    for (const log of logs) {
      const topics = log.topics;
      if (Array.isArray(topics) && topics.length >= 2) {
        const topic0 = String(topics[0] ?? '').toLowerCase();
        if (topic0 === MESSAGE_SENT_TOPIC0) ids.push(topics[1] as Hex);
      }
    }
    for (const id of ids) {
      const key = id.toLowerCase();
      const prev = bundleIndex.get(key) ?? {};
      bundleIndex.set(key, { bundleHash, srcTxHash: srcTxHash ?? prev.srcTxHash });
    }
  }
}
