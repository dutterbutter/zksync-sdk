// import { describe, it, expect } from "bun:test";
// import {
//   zksRpcFromEthers,
//   normalizeProof,
// } from "../zks";
// import type { ReceiptWithL2ToL1, ProofNormalized } from "../types";

// // -- Tiny helpers -------------------------------------------------------------

// function hex(x: string) {
//   return x.startsWith("0x") ? (x as `0x${string}`) : (`0x${x}` as `0x${string}`);
// }

// class MockProvider {
//   private replies: Record<string, (params: any[]) => any> = {};

//   on(method: string, fn: (params: any[]) => any) {
//     this.replies[method] = fn;
//     return this;
//   }

//   async send(method: string, params: any[]): Promise<any> {
//     const fn = this.replies[method];
//     if (!fn) throw new Error(`Unexpected RPC: ${method}`);
//     return await fn(params);
//   }
// }

// // -- normalizeProof() ---------------------------------------------------------

// describe("normalizeProof()", () => {
//   it("accepts snake_case fields", () => {
//     const normalized = normalizeProof({
//       id: 7,
//       batch_number: "42",
//       proof: ["0x01", "0x02"],
//     });
//     expect(normalized).toEqual<ProofNormalized>({
//       id: 7n,
//       batchNumber: 42n,
//       proof: ["0x01", "0x02"],
//     });
//   });

//   it("accepts camelCase index/batchNumber fallback", () => {
//     const normalized = normalizeProof({
//       index: "3",
//       batchNumber: 9,
//       proof: ["0xab"],
//     });
//     expect(normalized.id).toBe(3n);
//     expect(normalized.batchNumber).toBe(9n);
//     expect(normalized.proof).toEqual(["0xab"]);
//   });

//   it("coerces decimal strings and numbers to bigint", () => {
//     const n = normalizeProof({ id: "10", batch_number: 11, proof: [] });
//     expect(n.id).toBe(10n);
//     expect(n.batchNumber).toBe(11n);
//   });

//   it("throws on missing fields", () => {
//     expect(() => normalizeProof({ id: 1 })).toThrow("ProofMalformed");
//     expect(() => normalizeProof({ batch_number: 2 })).toThrow("ProofMalformed");
//   });

//   it("throws on invalid types", () => {
//     expect(() => normalizeProof({ id: {}, batch_number: 1 })).toThrow("ProofType");
//     expect(() => normalizeProof({ id: 1, batch_number: {} })).toThrow("ProofType");
//   });

//   it("normalizes proof array to 0x-prefixed hex", () => {
//     const n = normalizeProof({ id: 1, batch_number: 2, proof: ["ab", "0xcd"] });
//     expect(n.proof).toEqual(["0xab", "0xcd"]);
//   });
// });

// // -- zksRpcFromEthers() -------------------------------------------------------

// describe("zksRpcFromEthers()", () => {
//   it("getBridgehub() returns checksummed-looking address string", async () => {
//     const l2 = new MockProvider().on("zks_getBridgehubContract", () => "0x000000000000000000000000000000000000BEEF");

//     const rpc = zksRpcFromEthers();
//     const addr = await rpc.getBridgehub(l2 as any);
//     expect(addr).toBe("0x000000000000000000000000000000000000BEEF");
//   });

//   it("getBridgehub() throws if not a string", async () => {
//     const l2 = new MockProvider().on("zks_getBridgehubContract", () => ({ nope: true }));
//     const rpc = zksRpcFromEthers();
//     await expect(rpc.getBridgehub(l2 as any)).rejects.toThrow("Invalid response");
//   });

//   it("getL2ToL1LogProof() returns raw proof and caller can normalize", async () => {
//     const tx = hex("dead");
//     const idx = 0;

//     const l2 = new MockProvider().on("zks_getL2ToL1LogProof", ([hash, i]) => {
//       expect(hash).toBe(tx);
//       expect(i).toBe(idx);
//       return {
//         id: "5",
//         batch_number: 12,
//         proof: ["0x11", "22"],
//       };
//     });

//     const rpc = zksRpcFromEthers();
//     const proofRaw = await rpc.getL2ToL1LogProof(l2 as any, tx, idx);
//     const proof = normalizeProof(proofRaw);
//     expect(proof).toEqual<ProofNormalized>({
//       id: 5n,
//       batchNumber: 12n,
//       proof: ["0x11", "0x22"],
//     });
//   });

//   it("getL2ToL1LogProof() throws on empty", async () => {
//     const l2 = new MockProvider().on("zks_getL2ToL1LogProof", () => null);
//     const rpc = zksRpcFromEthers();
//     await expect(rpc.getL2ToL1LogProof(l2 as any, hex("aa"), 0)).rejects.toThrow("ProofUnavailable");
//   });

//   it("getRawReceipt() returns raw receipt with l2ToL1Logs", async () => {
//     const h = hex("deadbeef");
//     const raw: ReceiptWithL2ToL1 = {
//       transactionHash: h,
//       blockHash: hex("b0b"),
//       status: "0x1",
//       // …only include fields your type requires for tests…
//       l2ToL1Logs: [
//         {
//           l2_shard_id: 0,
//           is_service: true,
//           tx_number_in_block: 3,
//           sender: "0x0000000000000000000000000000000000008008",
//           key: hex("cafe"),
//           value: hex("01"),
//         },
//       ],
//     } as any;

//     const p = new MockProvider().on("eth_getTransactionReceipt", ([txHash]) => {
//       expect(txHash).toBe(h);
//       return raw;
//     });

//     const rpc = zksRpcFromEthers();
//     const out = await rpc.getRawReceipt(p as any, h);
//     expect(out?.l2ToL1Logs?.length).toBe(1);
//     expect(out?.l2ToL1Logs?.[0]?.sender.toLowerCase()).toBe("0x0000000000000000000000000000000000008008");
//   });

//   it("getRawReceipt() returns null passthrough", async () => {
//     const p = new MockProvider().on("eth_getTransactionReceipt", () => null);
//     const rpc = zksRpcFromEthers();
//     const out = await rpc.getRawReceipt(p as any, hex("bb"));
//     expect(out).toBeNull();
//   });
// });
