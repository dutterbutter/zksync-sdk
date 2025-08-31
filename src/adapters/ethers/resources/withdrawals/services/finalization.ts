/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
// src/adapters/ethers/resources/withdrawals/index.ts
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Contract,
  Interface,
  type TransactionReceipt,
} from "ethers";
import type { Address, Hex } from "../../../../../types/primitives";
import type { TransactionReceiptZKsyncOS } from "../routes/types";
import type { EthersClient } from "../../../client";
import { FinalizeDepositParams, type WithdrawalKey } from "../../../../../types/flows/withdrawals";
import { L2_MESSENGER_ADDR } from "../../utils";

import IBridgehubABI from "../../../../../internal/abis/json/IBridgehub.json" assert { type: "json" };
import IL1AssetRouterABI from "../../../../../internal/abis/json/IL1AssetRouter.json" assert { type: "json" };
import IL1NullifierABI from "../../../../../internal/abis/json/IL1Nullifier.json" assert { type: "json" };

export interface FinalizationServices {
  l2WaitForTransaction(hash: string): Promise<TransactionReceipt | null>;

  /** Enrich with l2ToL1Logs when supported */
  enrichL2Receipt(
    hash: string,
    rcpt: TransactionReceipt | null
  ): Promise<TransactionReceiptZKsyncOS | null>;

  fetchFinalizeDepositParams(
    l2TxHash: Hex
  ): Promise<{ params: FinalizeDepositParams; l1AssetRouter: Address; nullifier: Address }>;

  isWithdrawalFinalized(
    l1AssetRouter: Address,
    key: WithdrawalKey
  ): Promise<boolean>;

  finalizeDeposit?(
    params: FinalizeDepositParams,
    nullifier: Address
  ): Promise<{ hash: string; wait: () => Promise<TransactionReceipt> }>;

  /** NEW: allow callers (commonCtx) to inject known addresses to avoid discovery */
  primeKnownAddresses(addrs: { l1AssetRouter?: Address; nullifier?: Address }): void;
}

export function createFinalizationServices(client: EthersClient): FinalizationServices {
  const l1 = client.l1;
  const l2 = client.l2;
  const signer = client.signer;

  const IBridgehub    = new Interface(IBridgehubABI as any);
  const IL1AssetRouter = new Interface(IL1AssetRouterABI as any);
  const IL1Nullifier   = new Interface(IL1NullifierABI as any);

  // --- tiny local cache primed by commonCtx ---
  const known: { l1AssetRouter?: Address; nullifier?: Address } = {};

  async function resolveRouters(): Promise<{ l1AssetRouter: Address; nullifier: Address }> {
    // Prefer primed addresses
    if (known.l1AssetRouter && known.nullifier) {
      return { l1AssetRouter: known.l1AssetRouter, nullifier: known.nullifier };
    }
    // Fallback: discover via Bridgehub (once)
    const { bridgehub } = await client.ensureAddresses();
    const bh = new Contract(bridgehub, IBridgehub, l1);
    const l1AssetRouter = (await bh.sharedBridge()) as Address;
    const ar = new Contract(l1AssetRouter, IL1AssetRouter, l1);
    const nullifier = (await ar.L1_NULLIFIER()) as Address;

    // cache for next time
    known.l1AssetRouter = l1AssetRouter;
    known.nullifier = nullifier;

    return { l1AssetRouter, nullifier };
  }

  return {
    primeKnownAddresses(addrs) {
      if (addrs.l1AssetRouter) known.l1AssetRouter = addrs.l1AssetRouter;
      if (addrs.nullifier)     known.nullifier     = addrs.nullifier;
    },

    async l2WaitForTransaction(hash: string) {
      return l2.waitForTransaction(hash);
    },

    async enrichL2Receipt(hash: string, rcpt: TransactionReceipt | null) {
      if (!rcpt) return null;
      try {
        const raw = await (l2 as any).send("eth_getTransactionReceipt", [hash]);
        (rcpt as any).l2ToL1Logs = raw?.l2ToL1Logs ?? [];
      } catch {
        (rcpt as any).l2ToL1Logs = (rcpt as any).l2ToL1Logs ?? [];
      }
      return rcpt as TransactionReceiptZKsyncOS;
    },

    async fetchFinalizeDepositParams(l2TxHash: Hex) {
      const l2Rcpt = await l2.getTransactionReceipt(l2TxHash);
      if (!l2Rcpt) throw new Error("No L2 receipt found");

      // Ensure l2ToL1Logs
      let logs: any[] = (l2Rcpt as any).l2ToL1Logs;
      if (!logs) {
        try {
          const raw = await (l2 as any).send("eth_getTransactionReceipt", [l2TxHash]);
          logs = raw?.l2ToL1Logs ?? [];
          (l2Rcpt as any).l2ToL1Logs = logs;
        } catch {
          logs = [];
          (l2Rcpt as any).l2ToL1Logs = logs;
        }
      }

      // Pick messenger log
      const idx = logs.findIndex(
        (log) => (log.sender ?? "").toLowerCase() === L2_MESSENGER_ADDR.toLowerCase()
      );
      if (idx === -1) throw new Error("No messenger l2ToL1 log found");

      const chosenLog = logs[idx];

      // Proof for that message
      const proof = await (l2 as any).send("zks_getL2ToL1LogProof", [l2TxHash, idx]);
      if (!proof) throw new Error("No proof returned from zks_getL2ToL1LogProof");

      const net = await l2.getNetwork();

      const params: FinalizeDepositParams = {
        chainId: BigInt(net.chainId),
        l2BatchNumber: BigInt(proof.batch_number ?? proof.batchNumber),
        l2MessageIndex: BigInt(proof.id ?? proof.index ?? 0),
        l2Sender: chosenLog.sender as Address,
        l2TxNumberInBatch: Number(chosenLog.tx_number_in_block ?? 0),
        message: chosenLog.value as Hex,
        merkleProof: (proof.proof ?? []) as Hex[],
      };

      const { l1AssetRouter, nullifier } = await resolveRouters();
      return { params, l1AssetRouter, nullifier };
    },

    async isWithdrawalFinalized(l1AssetRouter: Address, key: WithdrawalKey) {
      const router = new Contract(l1AssetRouter, IL1AssetRouter, l1);
      return await router.isWithdrawalFinalized(
        key.chainIdL2,
        key.l2BatchNumber,
        key.l2MessageIndex
      );
    },

    async finalizeDeposit(params: FinalizeDepositParams, nullifier: Address) {
      const c = new Contract(nullifier, IL1Nullifier, signer);
      const tx = await c.finalizeDeposit(params);
      return { hash: tx.hash, wait: () => tx.wait() };
    }
  };
}
