// import type { Provider, Log, BlockTag, Filter } from 'ethers';
// import type { MessageReceipt, BundleReceipt, MessageStatus } from '@zksync-sdk/core';
// import { Handler } from '../internal/abi';
// import { bundleIndex } from '../internal/cache';

// type Hex = `0x${string}`;

// export async function awaitFinalization(
//   providers: { src: Provider; dest: Provider },
//   q: { sendId: Hex; timeoutMs?: number; signal?: AbortSignal; destHandlerAddr?: Hex }
// ): Promise<MessageReceipt | BundleReceipt> {
//   const start = Date.now();
//   const timeout = q.timeoutMs ?? 5 * 60_000;

//   const cached = bundleIndex.get(q.sendId.toLowerCase());
//   const bundleHash = cached?.bundleHash;
//   const timeline: MessageReceipt['timeline'] = [
//     { at: Math.floor(start / 1000), phase: 'sent', txHash: cached?.srcTxHash }
//   ];

//   if (!bundleHash || !q.destHandlerAddr) {
//     return { sendId: q.sendId, phase: 'sent', lastUpdateTs: Math.floor(Date.now() / 1000), timeline };
//   }

//   let destTxHash: Hex | undefined;
//   let phase: MessageReceipt['phase'] = 'proven';
//   const fromBlock: BlockTag = 0n; const toBlock: BlockTag = 'latest';

//   while (Date.now() - start < timeout) {
//     if (q.signal?.aborted) throw new Error('AbortError');

//     const verifiedFilter: Filter = { address: q.destHandlerAddr, topics: [ Handler.getEventTopic('BundleVerified'), bundleHash ], fromBlock, toBlock };
//     const verified: Log[] = await providers.dest.getLogs(verifiedFilter);
//     if (verified.length && !timeline.find(t => t.phase === 'proven')) {
//       timeline.push({ at: Math.floor(Date.now()/1000), phase: 'proven' });
//     }

//     const executedFilter: Filter = { address: q.destHandlerAddr, topics: [ Handler.getEventTopic('BundleExecuted'), bundleHash ], fromBlock, toBlock };
//     const executed: Log[] = await providers.dest.getLogs(executedFilter);

//     const unbundledFilter: Filter = { address: q.destHandlerAddr, topics: [ Handler.getEventTopic('BundleUnbundled'), bundleHash ], fromBlock, toBlock };
//     const unbundled: Log[] = await providers.dest.getLogs(unbundledFilter);

//     if (executed.length || unbundled.length) {
//       phase = 'finalized';
//       const last: Log | undefined = (executed[executed.length - 1] ?? unbundled[unbundled.length - 1]);
//       destTxHash = (last?.transactionHash ?? undefined) as Hex | undefined;
//       break;
//     }
//     await new Promise<void>((r) => setTimeout(r, 1500));
//   }

//   return { sendId: q.sendId, phase, destTxHash, lastUpdateTs: Math.floor(Date.now() / 1000), timeline };
// }

// export async function getMessageStatus(
//   _providerSrc: Provider,
//   q: { sendId: Hex }
// ): Promise<MessageStatus> {
//   const cached = bundleIndex.get(q.sendId.toLowerCase());
//   const phase: MessageStatus['phase'] = cached?.bundleHash ? 'proven' : 'sent';
//   return { sendId: q.sendId, phase, lastUpdateTs: Math.floor(Date.now() / 1000) };
// }
