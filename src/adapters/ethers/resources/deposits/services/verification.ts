/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Interface, type Log, type Provider, type TransactionReceipt } from 'ethers';
import type { Hex } from '../../../../../core/types/primitives';
import { isHash66 } from '../../../../../core/utils/addr';
import { TOPIC_CANONICAL_ASSIGNED, TOPIC_CANONICAL_SUCCESS } from '../../../../../core/constants';

const I_BRIDGEHUB = new Interface([
  'event NewPriorityRequest(uint256 indexed chainId, address indexed sender, bytes32 txHash, uint256 txId, bytes data)',
]);
const TOPIC_BRIDGEHUB_NPR = I_BRIDGEHUB.getEvent('NewPriorityRequest')!.topicHash;

export function extractL2TxHashFromL1Logs(logs: ReadonlyArray<Log>): Hex | null {
  for (const lg of logs) {
    if ((lg.topics?.[0] ?? '').toLowerCase() === TOPIC_BRIDGEHUB_NPR.toLowerCase()) {
      try {
        const ev = I_BRIDGEHUB.decodeEventLog('NewPriorityRequest', lg.data, lg.topics);
        const h = ev.txHash as string;
        if (isHash66(h)) return h;
      } catch {
        // ignore
      }
    }
  }
  // Fallback
  for (const lg of logs) {
    const t0 = (lg.topics?.[0] ?? '').toLowerCase();
    if (t0 === TOPIC_CANONICAL_ASSIGNED.toLowerCase()) {
      const h = lg.topics?.[2];
      if (isHash66(h)) return h;
    }
    if (t0 === TOPIC_CANONICAL_SUCCESS.toLowerCase()) {
      const h = lg.topics?.[3];
      if (isHash66(h)) return h;
    }
  }

  return null;
}

export async function waitForL2ExecutionFromL1Tx(
  l1: Provider,
  l2: Provider,
  l1TxHash: Hex,
): Promise<{ l2Receipt: TransactionReceipt; l2TxHash: Hex }> {
  const l1Receipt = await l1.waitForTransaction(l1TxHash);
  if (!l1Receipt) throw new Error('No L1 receipt found');

  const l2TxHash = extractL2TxHashFromL1Logs(l1Receipt.logs);
  if (!l2TxHash) {
    throw new Error('Could not find canonical L2 tx hash in L1 receipt logs.');
  }

  const l2Receipt = await l2.waitForTransaction(l2TxHash);
  if (!l2Receipt) throw new Error('No L2 receipt found');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((l2Receipt as any).status !== 1) {
    throw new Error(`L2 deposit execution failed (tx: ${l2TxHash})`);
  }

  return { l2Receipt, l2TxHash };
}
