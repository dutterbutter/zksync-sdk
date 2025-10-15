// src/adapters/ethers/resources/interop/services/monitor.ts
import type { Log, TransactionReceipt, Interface } from 'ethers';
import type { EthersClient } from '../../../client';
import type { Hex } from '../../../../../core/types/primitives';
import type {
  InteropHandle,
  InteropWaitable,
  InteropStatus,
} from '../../../../../core/types/flows/interop';
import type { ParsedLog, ParsedReceipt } from '../../../../../core/types/flows/base';

import { createErrorHandlers } from '../../../errors/error-ops';
import { deriveStatusFromReceipts } from '../../../../../core/resources/interop/logs';
import { OP_INTEROP } from '../../../../../core/types/errors';

const { wrapAs } = createErrorHandlers('interop');

/* ---------------- Small helpers (kept local; can be moved to utils/ if reused) ---------------- */

const isHex32 = (v: unknown): v is Hex => typeof v === 'string' && /^0x[0-9a-fA-F]{64}$/.test(v);

function topic(iface: Interface, name: string): Hex {
  const frag = iface.getEvent(name);
  if (!frag) throw new Error(`Event "${name}" not found in ABI`);
  return frag.topicHash as Hex;
}

function toParsedReceipt(rcpt: TransactionReceipt | null | undefined): ParsedReceipt | undefined {
  if (!rcpt) return undefined;
  return {
    transactionHash: rcpt.hash as Hex,
    logs: (rcpt.logs ?? []).map(
      (lg: Log): ParsedLog => ({
        address: lg.address,
        topics: lg.topics as unknown as readonly Hex[],
        data: lg.data as Hex,
      }),
    ),
  };
}

function normalizeWaitable(h: InteropWaitable | Hex): {
  l2SrcTxHash?: Hex;
  l1MsgHash?: Hex;
  bundleHash?: Hex;
  dstExecTxHash?: Hex;
  dstChainId?: bigint;
} {
  if (typeof h === 'string') return { l2SrcTxHash: h };
  const maybeHandle = h as InteropHandle<unknown>;
  const fromObj = h;
  return {
    l2SrcTxHash: maybeHandle.l2SrcTxHash ?? fromObj.l2SrcTxHash,
    l1MsgHash: maybeHandle.l1MsgHash ?? fromObj.l1MsgHash,
    bundleHash: maybeHandle.bundleHash ?? fromObj.bundleHash,
    dstExecTxHash: maybeHandle.dstExecTxHash ?? fromObj.dstExecTxHash,
    dstChainId: maybeHandle.dstChainId,
  };
}

function extractSentHashes(
  centerIface: Interface,
  log: Log,
): { l1MsgHash?: Hex; bundleHash?: Hex } {
  // parseLog only needs { topics, data }
  const parsed = centerIface.parseLog({ topics: log.topics, data: log.data });
  if (!parsed) return {};
  const args = parsed.args as readonly unknown[];
  const a0 = args[0];
  const a1 = args[1];
  const l1MsgHash = isHex32(a0) ? a0 : undefined;
  const bundleHash = isHex32(a1) ? a1 : undefined;
  return { l1MsgHash, bundleHash };
}

async function buildTopicsPack(client: EthersClient) {
  const c = await client.contracts(); // source-bound; we only need interfaces
  return {
    InteropBundleSent: topic(c.interopCenter.interface, 'InteropBundleSent'),
    BundleVerified: topic(c.interopHandler.interface, 'BundleVerified'),
    BundleExecuted: topic(c.interopHandler.interface, 'BundleExecuted'),
    BundleUnbundled: topic(c.interopHandler.interface, 'BundleUnbundled'),
  };
}

/* ---------------- Public: status & wait ---------------- */

export async function status(
  client: EthersClient,
  h: InteropWaitable | Hex,
): Promise<InteropStatus> {
  const {
    l2SrcTxHash,
    l1MsgHash: hintL1,
    bundleHash: hintBundle,
    dstExecTxHash: hintDstTx,
    dstChainId,
  } = normalizeWaitable(h);

  if (!l2SrcTxHash) return { phase: 'UNKNOWN' };

  // ----- SOURCE receipt -----
  const srcReceipt = await wrapAs(
    'RPC',
    OP_INTEROP.svc.status.sourceReceipt,
    () => client.l2.getTransactionReceipt(l2SrcTxHash),
    {
      ctx: { where: 'l2.getTransactionReceipt', l2SrcTxHash },
      message: 'Failed to fetch source L2 receipt.',
    },
  );
  if (!srcReceipt) return { phase: 'SENT', l2SrcTxHash };

  const addrs = await wrapAs(
    'INTERNAL',
    OP_INTEROP.svc.status.ensureAddresses,
    () => client.ensureAddresses(),
    { ctx: { where: 'ensureAddresses' }, message: 'Failed to ensure interop addresses.' },
  );

  const c = await client.contracts();
  const centerIface = c.interopCenter.interface;
  const sentTopic = topic(centerIface, 'InteropBundleSent').toLowerCase();

  const sentLog = (srcReceipt.logs ?? []).find(
    (lg) =>
      (lg.address ?? '').toLowerCase() === addrs.interopCenter.toLowerCase() &&
      (lg.topics?.[0] ?? '').toLowerCase() === sentTopic,
  );

  let l1MsgHash: Hex | undefined = hintL1;
  let bundleHash: Hex | undefined = hintBundle;
  if (sentLog) {
    const hashes = extractSentHashes(centerIface, sentLog);
    l1MsgHash ??= hashes.l1MsgHash;
    bundleHash ??= hashes.bundleHash;
  }

  // Without destination or bundle id: we can only report SENT.
  if (!dstChainId || !bundleHash) {
    return { phase: 'SENT', l2SrcTxHash, l1MsgHash, bundleHash };
  }

  // ----- DESTINATION logs -----
  const dstProvider = await wrapAs(
    'INTERNAL',
    OP_INTEROP.svc.status.requireDstProvider,
    () => Promise.resolve(client.requireProvider(dstChainId)),
    {
      ctx: { where: 'requireProvider', dstChainId },
      message: `No provider registered for destination chainId ${dstChainId}.`,
    },
  );

  const vTopic = topic(c.interopHandler.interface, 'BundleVerified');
  const eTopic = topic(c.interopHandler.interface, 'BundleExecuted');
  const uTopic = topic(c.interopHandler.interface, 'BundleUnbundled');

  const dstLogs = await wrapAs(
    'RPC',
    OP_INTEROP.svc.status.dstLogs,
    () =>
      dstProvider.getLogs({
        address: addrs.interopHandler,
        topics: [[vTopic, eTopic, uTopic], bundleHash],
        fromBlock: 0n,
        toBlock: 'latest',
      }),
    {
      ctx: { where: 'dst.getLogs', interopHandler: addrs.interopHandler, bundleHash, dstChainId },
      message: 'Failed to query destination handler logs.',
    },
  );

  const dstExecTxHash: Hex | undefined =
    hintDstTx ?? (dstLogs?.[0]?.transactionHash as Hex | undefined);

  const dstParsed: ParsedReceipt | undefined =
    dstLogs && dstLogs.length
      ? {
          transactionHash: (dstExecTxHash ?? dstLogs[0].transactionHash) as Hex,
          logs: dstLogs.map(
            (lg): ParsedLog => ({
              address: lg.address,
              topics: lg.topics as unknown as readonly Hex[],
              data: lg.data as Hex,
            }),
          ),
        }
      : undefined;

  // ----- Map to InteropStatus via core helper -----
  const topics = await buildTopicsPack(client);

  return deriveStatusFromReceipts({
    source: toParsedReceipt(srcReceipt),
    destination: dstParsed,
    topics,
    hints: { l1MsgHash, bundleHash, dstExecTxHash },
  });
}

export async function wait(
  client: EthersClient,
  h: InteropWaitable | Hex,
  opts: { for: 'verified' | 'executed'; pollMs?: number; timeoutMs?: number },
): Promise<null> {
  const pollMs = Math.max(1000, opts.pollMs ?? 5500);
  const until = opts.timeoutMs ? Date.now() + opts.timeoutMs : undefined;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const s = await status(client, h);

    if (opts.for === 'verified') {
      if (s.phase === 'VERIFIED' || s.phase === 'EXECUTED' || s.phase === 'UNBUNDLED') return null;
    } else {
      if (s.phase === 'EXECUTED' || s.phase === 'UNBUNDLED') return null;
    }

    if (until && Date.now() > until) return null;
    await new Promise((r) => setTimeout(r, pollMs));
  }
}
