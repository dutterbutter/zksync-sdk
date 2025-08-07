// import type {
//   ChainRegistry, ChainRef, ChainInfo,
//   BundleInput, RemoteCallInput, NativeTransferInput, ERC20TransferInput,
//   SentMessage, Estimate, MessageReceipt, MessageStatus, BundleReceipt
// } from '@zksync-sdk/core';
// import {
//   InteropCenterAbi,
//   InteropHandlerAbi,
//   encodeEvmV1AddressOnly,
//   encodeEvmV1ChainOnly,
//   toCallStarter,
//   mergeAttributes,
//   parseSendIdFromLogs,
//   fromEvmError
// } from '@zksync-sdk/core';
// import {
//   Interface,
//   id,
//   type InterfaceAbi,
//   type Signer,
//   type Provider,
//   type TransactionReceipt,
//   type Log,
//   type BlockTag,
//   type Filter
// } from 'ethers';

// // ---------- helpers ----------
// type Hex = `0x${string}`;

// function resolveChain(registry: ChainRegistry, ref: ChainRef): ChainInfo {
//   // Prefer resolveRef (key | alias | chainId) if available, else resolve(string)
//   if ('resolveRef' in registry && typeof registry.resolveRef === 'function') {
//     return registry.resolveRef(ref);
//   }
//   if ('resolve' in registry && typeof registry.resolve === 'function') {
//     // If someone passes number as ref and only resolve(string) exists, coerce to string
//     return registry.resolve(String(ref));
//   }
//   // Keep as a regular Error to avoid coupling core error class here
//   throw new Error('CONFIG_MISSING: registry.resolveRef/resolve not found');
// }

// const Center = new Interface(InteropCenterAbi as InterfaceAbi);
// const Handler = new Interface(InteropHandlerAbi as InterfaceAbi);

// // topic0 for MessageSent(bytes32,bytes,bytes,bytes,uint256,bytes[])
// const MESSAGE_SENT_TOPIC0 = id('MessageSent(bytes32,bytes,bytes,bytes,uint256,bytes[])').toLowerCase();

// // In-memory index so await/getStatus can correlate a sendId to its bundleHash + src tx.
// const bundleIndex = new Map<string, { bundleHash?: Hex; srcTxHash?: Hex }>();

// function indexFromReceipt(sendId: Hex | undefined, srcTxHash: Hex, receipt: TransactionReceipt): void {
//   const logs: readonly Log[] = receipt.logs ?? [];
//   let bundleHash: Hex | undefined;

//   // 1) capture InteropBundleSent(bundleHash)
//   for (const log of logs) {
//     try {
//       const dec = Center.parseLog(log);
//       if (dec?.name === 'InteropBundleSent') {
//         // dec.args.interopBundleHash is BytesLike; ethers coerces to 0x-hex string
//         bundleHash = dec.args.interopBundleHash as Hex;
//         break;
//       }
//     } catch (_ignore) {
//       // parseLog throws if the log doesn't match this ABI; ignore and continue
//     }
//   }

//   // 2) if we have a sendId and maybe bundleHash, record them
//   if (sendId) {
//     const key = sendId.toLowerCase();
//     const prev = bundleIndex.get(key) ?? {};
//     bundleIndex.set(key, { bundleHash: bundleHash ?? prev.bundleHash, srcTxHash: srcTxHash ?? prev.srcTxHash });
//   }

//   // 3) also index ALL MessageSent sendIds in the same receipt (multi-call bundle)
//   if (bundleHash) {
//     const allSendIds: Hex[] = [];
//     for (const log of logs) {
//       const topics = log.topics;
//       if (Array.isArray(topics) && topics.length >= 2) {
//         const topic0 = String(topics[0] ?? '').toLowerCase();
//         if (topic0 === MESSAGE_SENT_TOPIC0) {
//           allSendIds.push(topics[1] as Hex);
//         }
//       }
//     }
//     for (const id of allSendIds) {
//       const key = id.toLowerCase();
//       const prev = bundleIndex.get(key) ?? {};
//       bundleIndex.set(key, { bundleHash, srcTxHash: srcTxHash ?? prev.srcTxHash });
//     }
//   }
// }

// function computeMsgValue(items: BundleInput['items']): bigint {
//   let total = 0n;
//   for (const it of items) {
//     if (it.kind === 'nativeTransfer') total += it.amount;
//     if (it.kind === 'remoteCall' && it.value) total += it.value;
//     // NOTE: extend here for indirectCallMessageValue if/when we add it to BundleItem.
//   }
//   return total;
// }

// // ---------- actions ----------

// export async function remoteCallEthers(
//   signer: Signer,
//   input: RemoteCallInput & { registry: ChainRegistry }
// ): Promise<SentMessage> {
//   try {
//     const src = resolveChain(input.registry, input.src!);
//     const center = src.addresses.interopCenter;

//     const attributes = mergeAttributes(
//       input.attributes,
//       input.value && input.value > 0n ? [] : [] // placeholder: no extra attrs needed right now
//     );

//     const data = Center.encodeFunctionData('sendMessage', [
//       encodeEvmV1AddressOnly(input.to),
//       input.data,
//       attributes
//     ]);

//     const tx = await signer.sendTransaction({ to: center, data, value: input.value ?? 0n });
//     const rc = await tx.wait();
//     const sendId = parseSendIdFromLogs(rc) as Hex | undefined;

//     if (!sendId) {
//       // We didn't find MessageSent; still return tx hash for debugging
//       // (callers can fall back to explorer or re-parse logs if needed)
//     }

//     // index bundleHash/sendId for later finalization checks (best-effort)
//     try {
//       indexFromReceipt(sendId, tx.hash as Hex, rc as TransactionReceipt);
//     } catch {
//       /* ignore indexing errors */
//     }

//     return { sendId: (sendId ?? '0x') as Hex, srcTxHash: tx.hash as Hex };
//   } catch (e: unknown) {
//     throw fromEvmError(e, 'remoteCallEthers');
//   }
// }

// export async function sendNativeEthers(
//   signer: Signer,
//   input: NativeTransferInput & { registry: ChainRegistry }
// ): Promise<SentMessage> {
//   // native transfer is just a single-call bundle with interopCallValue(amount) + empty payload
//   const bundle: BundleInput & { registry: ChainRegistry } = {
//     registry: input.registry,
//     src: input.src,
//     dest: input.dest,
//     attributes: input.attributes,
//     items: [{ kind: 'nativeTransfer', to: input.to, amount: input.amount }],
//   };
//   return sendBundleEthers(signer, bundle);
// }

// export async function sendERC20Ethers(
//   signer: Signer,
//   input: ERC20TransferInput & { registry: ChainRegistry }
// ): Promise<SentMessage> {
//   // ERC20 transfer is a bundle w/ a call to token.transfer(to, amount)
//   const bundle: BundleInput & { registry: ChainRegistry } = {
//     registry: input.registry,
//     src: input.src,
//     dest: input.dest,
//     attributes: input.attributes,
//     items: [{ kind: 'erc20Transfer', token: input.token, to: input.to, amount: input.amount, approveIfNeeded: input.approveIfNeeded }],
//   };
//   return sendBundleEthers(signer, bundle);
// }

// export async function sendBundleEthers(
//   signer: Signer,
//   input: BundleInput & { registry: ChainRegistry }
// ): Promise<SentMessage> {
//   try {
//     const src = resolveChain(input.registry, input.src!);
//     const dest = resolveChain(input.registry, input.dest!);

//     const starters = input.items.map(toCallStarter).map((x) => x.starter);
//     const bundleAttrs = (input.attributes ?? []).map((a) => a.data);
//     const encodedDest = encodeEvmV1ChainOnly(BigInt(dest.chainId));

//     const data = Center.encodeFunctionData('sendBundle', [encodedDest, starters, bundleAttrs]);
//     const msgValue = computeMsgValue(input.items);

//     const tx = await signer.sendTransaction({ to: src.addresses.interopCenter, data, value: msgValue });
//     const rc = await tx.wait();

//     // The sendId(s) are emitted via MessageSent (one per call). We return the first one (common pattern).
//     const sendId = parseSendIdFromLogs(rc) as Hex | undefined;

//     try {
//       indexFromReceipt(sendId, tx.hash as Hex, rc as TransactionReceipt);
//     } catch {
//       /* ignore indexing errors */
//     }

//     return { sendId: (sendId ?? '0x') as Hex, srcTxHash: tx.hash as Hex };
//   } catch (e: unknown) {
//     throw fromEvmError(e, 'sendBundleEthers');
//   }
// }

// // Heuristic bundle estimate; proper on-chain estimate may require sim + buffer.
// export async function estimateBundleEthers(
//   _provider: Provider,
//   input: BundleInput & { registry: ChainRegistry }
// ): Promise<Estimate> {
//   const base = 400_000n;
//   const perItem = 80_000n * BigInt(input.items.length);
//   return { gasLimit: (base + perItem) * 13n / 10n, notes: ['heuristic'] };
// }

// export async function awaitFinalizationEthers(
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

//   // If we don’t know the bundleHash or handler address, we can’t progress beyond “sent”.
//   if (!bundleHash || !q.destHandlerAddr) {
//     return { sendId: q.sendId, phase: 'sent', lastUpdateTs: Math.floor(Date.now() / 1000), timeline };
//   }

//   let destTxHash: Hex | undefined;
//   let phase: MessageReceipt['phase'] = 'proven';

//   const fromBlock: BlockTag = 0n;
//   const toBlock: BlockTag = 'latest';

//   // Poll destination for events
//   while (Date.now() - start < timeout) {
//     if (q.signal?.aborted) throw new Error('AbortError');

//     const verifiedFilter: Filter = {
//       address: q.destHandlerAddr,
//       topics: [ Handler.getEventTopic('BundleVerified'), bundleHash ],
//       fromBlock, toBlock
//     };
//     const verified: Log[] = await providers.dest.getLogs(verifiedFilter);

//     if (verified.length && !timeline.find(t => t.phase === 'proven')) {
//       timeline.push({ at: Math.floor(Date.now()/1000), phase: 'proven' });
//     }

//     const executedFilter: Filter = {
//       address: q.destHandlerAddr,
//       topics: [ Handler.getEventTopic('BundleExecuted'), bundleHash ],
//       fromBlock, toBlock
//     };
//     const executed: Log[] = await providers.dest.getLogs(executedFilter);

//     const unbundledFilter: Filter = {
//       address: q.destHandlerAddr,
//       topics: [ Handler.getEventTopic('BundleUnbundled'), bundleHash ],
//       fromBlock, toBlock
//     };
//     const unbundled: Log[] = await providers.dest.getLogs(unbundledFilter);

//     if (executed.length || unbundled.length) {
//       phase = 'finalized';
//       const last: Log | undefined = (executed[executed.length - 1] ?? unbundled[unbundled.length - 1]);
//       destTxHash = (last?.transactionHash ?? undefined) as Hex | undefined;
//       break;
//     }

//     await new Promise<void>((r) => setTimeout(r, 1500));
//   }

//   return {
//     sendId: q.sendId,
//     phase,
//     destTxHash,
//     lastUpdateTs: Math.floor(Date.now() / 1000),
//     timeline
//   };
// }

// export async function getMessageStatusEthers(
//   _providerSrc: Provider,
//   q: { sendId: Hex }
// ): Promise<MessageStatus> {
//   const cached = bundleIndex.get(q.sendId.toLowerCase());
//   const phase: MessageStatus['phase'] = cached?.bundleHash ? 'proven' : 'sent';
//   return { sendId: q.sendId, phase, lastUpdateTs: Math.floor(Date.now() / 1000) };
// }
