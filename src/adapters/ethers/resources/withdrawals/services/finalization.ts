/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
// src/adapters/ethers/resources/withdrawals/index.ts
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  AbiCoder,
  Contract,
  Interface,
  type TransactionReceipt,
  hexlify,
  BigNumberish,
  BytesLike,
} from "ethers";
import type { Address, Hex } from "../../../../../types/primitives";
import type { TransactionReceiptZKsyncOS } from "../routes/types";
import type { EthersClient } from "../../../client";
import { FinalizeDepositParams, type WithdrawalKey } from "../../../../../types/flows/withdrawals";
import { L2_ASSET_ROUTER_ADDR } from "../../utils";

import IBridgehubABI from "../../../../../internal/abis/IBridgehub.json" assert { type: "json" };
import IL1AssetRouterABI from "../../../../../internal/abis/IL1AssetRouter.json" assert { type: "json" };
import IL1NullifierABI from "../../../../../internal/abis/IL1Nullifier.json" assert { type: "json" };

import { _getWithdrawalLog, _getWithdrawalL2ToL1Log } from "../../helpers";

const IL1NullifierMini = [
  "function isWithdrawalFinalized(uint256,uint256,uint256) view returns (bool)"
] as const;

export function createFinalizationServices(client: EthersClient) {
  const l1 = client.l1;
  const l2 = client.l2;
  const signer = client.signer;

  const IBridgehub = new Interface(IBridgehubABI as any);
  const IL1AssetRouter = new Interface(IL1AssetRouterABI as any);
  const IL1Nullifier = new Interface(IL1NullifierABI as any);

  const known: { l1AssetRouter?: Address; nullifier?: Address } = {};

  async function resolveRouters(): Promise<{ l1AssetRouter: Address; nullifier: Address }> {
    if (known.l1AssetRouter && known.nullifier) return known as Required<typeof known>;
    const { bridgehub } = await client.ensureAddresses();
    const bh = new Contract(bridgehub, IBridgehub, l1);
    const l1AssetRouter = (await bh.assetRouter()) as Address;
    const ar = new Contract(l1AssetRouter, IL1AssetRouter, l1);
    const nullifier = (await ar.L1_NULLIFIER()) as Address;
    known.l1AssetRouter = l1AssetRouter;
    known.nullifier = nullifier;
    return { l1AssetRouter, nullifier };
  }

  return {
    primeKnownAddresses(addrs: { l1AssetRouter?: Address; nullifier?: Address }) {
      if (addrs.l1AssetRouter) known.l1AssetRouter = addrs.l1AssetRouter;
      if (addrs.nullifier)     known.nullifier     = addrs.nullifier;
    },

    async l2WaitForTransaction(hash: string) {
      return await l2.waitForTransaction(hash);
    },

    async enrichL2Receipt(hash: string, rcpt: TransactionReceipt | null) {
      const receipt = rcpt ?? (await l2.getTransactionReceipt(hash));
      if (!receipt) return null;
      try {
        const raw = await (l2 as any).send("eth_getTransactionReceipt", [hash]);
        (receipt as any).l2ToL1Logs = raw?.l2ToL1Logs ?? [];
      } catch {
        (receipt as any).l2ToL1Logs = (receipt as any).l2ToL1Logs ?? [];
      }
      return receipt as unknown as TransactionReceiptZKsyncOS;
    },

    // === The core: mirror the Rust e2e ===
    async fetchFinalizeDepositParams(l2TxHash: Hex) {
      const idx = 0;

      // 1) Find the L1MessageSent(...) event in normal logs and extract `message`
      const { log } = await _getWithdrawalLog(l2, l2TxHash, idx);
      const message = AbiCoder.defaultAbiCoder().decode(["bytes"], log.data)[0] as Hex;

      // 2) From raw receipt, pick the messenger L2->L1 log and get proof for its index
      const { l2ToL1LogIndex } = await _getWithdrawalL2ToL1Log(l2, l2TxHash, idx);
      const proof = await (l2 as any).send("zks_getL2ToL1LogProof", [
        hexlify(l2TxHash),
        l2ToL1LogIndex
      ]);
      if (!proof) throw new Error("node failed to provide proof for withdrawal log");

      // 3) Assemble params exactly like the test
      const { chainId } = await l2.getNetwork();

      // transactionIndex comes from the parsed receipt (ethers). If unavailable, default to 0.
      const parsed = await l2.getTransactionReceipt(l2TxHash);
      const txIndex = Number(parsed?.transactionIndex ?? 0);

      const params: FinalizeDepositParams = {
        chainId: chainId as unknown as BigNumberish,
        l2BatchNumber: (proof.batch_number ?? proof.batchNumber) as BigNumberish,
        l2MessageIndex: (proof.id ?? proof.index) as BigNumberish,
        // Rust derives sender from l2_to_l1_log.key; the Nullifier accepts AssetRouter or BaseToken.
        // For ERC-20 withdrawals, AssetRouter is the correct L2 sender:
        l2Sender: L2_ASSET_ROUTER_ADDR,
        l2TxNumberInBatch: txIndex,
        message,
        merkleProof: (proof.proof ?? []) as Hex[]
      };

      const { l1AssetRouter, nullifier } = await resolveRouters();
      return { params, l1AssetRouter, nullifier };
    },

    // IMPORTANT: query the Nullifier’s public mapping (not the AssetRouter)
    async isWithdrawalFinalized(_l1AssetRouter: Address, key: WithdrawalKey) {
      const { nullifier } = await resolveRouters();
      const c = new Contract(nullifier, IL1NullifierMini, l1);
      return await c.isWithdrawalFinalized(
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
