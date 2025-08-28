// import { Interface, Log, type AbstractProvider } from "ethers";
// import type { Hex } from "../../../../types/primitives";
// import type { TransactionReceipt as EthersTxReceipt } from "ethers";

// // --- ABI for NewPriorityRequest: keep only fields we need (txHash) ---
// const NEW_PRIORITY_IFACE = new Interface([
//   // if txHash is not indexed; if your impl has a different tail, decoding still works
//   "event NewPriorityRequest(bytes32 txHash, address sender, uint256 txId, uint256 value, uint64 expiration, bytes data)",
//   // fallback shape (some variants use uint256 for expiration or reorder). We'll try both.
//   "event NewPriorityRequest(bytes32 txHash, address sender, uint256 txId, uint256 value, uint256 expiration, bytes data)",
// ]);

// /** Try to decode the L2 tx hash from any log using the NewPriorityRequest ABIs. */
// export function tryExtractL2TxHashFromLogs(logs: ReadonlyArray<Log>): Hex | null {
//   for (const log of logs) {
//     try {
//       const parsed = NEW_PRIORITY_IFACE.parseLog(log);
//       if (parsed?.name !== "NewPriorityRequest") continue;

//       // args may be both indexed/non-indexed; ethers normalizes them
//       const txHash = (parsed.args?.txHash ?? parsed.args?.[0]) as string | undefined;
//       if (txHash && txHash.startsWith("0x") && txHash.length === 66) {
//         return txHash as Hex;
//       }
//     } catch {
//       // parseLog throws if the topics don't match any event in the interface; ignore
//     }
//   }
//   return null;
// }

// /** Raw-call eth_getTransactionReceipt to access zkSync-specific fields like l2ToL1Logs. */
// export async function getRawReceipt(provider: AbstractProvider, hash: Hex): Promise<any | null> {
//   const rpc = provider as unknown as { send(m: string, p: unknown[]): Promise<any> };
//   return await rpc.send("eth_getTransactionReceipt", [hash]);
// }

// /** Check the zkSync OS service log marks the canonical tx hash as successful (value == 1). */
// export function isServiceSuccess(rawL2Receipt: any, l2TxHash: Hex): boolean {
//   const logs = rawL2Receipt?.l2ToL1Logs ?? [];
//   if (!Array.isArray(logs) || logs.length === 0) return false;

//   // 0x...8001 system address
//   const SYS = "0x0000000000000000000000000000000000008001".toLowerCase();

//   for (const lg of logs) {
//     const sender = String(lg.sender ?? "").toLowerCase();
//     const isService = !!lg.is_service || !!lg.isService; // handle both casings
//     const key = String(lg.key ?? "");
//     const value = String(lg.value ?? "0x0"); // hex 0x1 on success

//     if (isService && sender === SYS && key.toLowerCase() === l2TxHash.toLowerCase()) {
//       // value may be hex "0x1" or number 1
//       if (value === "0x1" || value === "1" || Number(value) === 1) return true;
//     }
//   }
//   return false;
// }

// /** Wait helper with timeout/backoff. Returns raw receipt (L2) when condition met, else null. */
// export async function pollUntil<T>(
//   fn: () => Promise<T | null>,
//   opts: { timeoutMs?: number; intervalMs?: number } = {}
// ): Promise<T | null> {
//   const timeoutMs = opts.timeoutMs ?? 120_000;  // 2m default
//   const intervalMs = opts.intervalMs ?? 1_000;  // 1s
//   const start = Date.now();
//   while (true) {
//     const v = await fn();
//     if (v) return v;
//     if (Date.now() - start > timeoutMs) return null;
//     await new Promise((r) => setTimeout(r, intervalMs));
//   }
// }

// /** Optional: for 'finalized' — existence of a proof is a strong signal the L2 result is enshrined. */
// export async function hasL2ToL1Proof(providerL2: AbstractProvider, l2TxHash: Hex): Promise<boolean> {
//   const rpc = providerL2 as unknown as { send(m: string, p: unknown[]): Promise<any> };
//   try {
//     const proof = await rpc.send("zks_getL2ToL1LogProof", [l2TxHash]);
//     return !!proof;
//   } catch {
//     return false;
//   }
// }
