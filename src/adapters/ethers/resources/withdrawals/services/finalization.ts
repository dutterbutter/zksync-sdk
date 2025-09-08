/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
// src/adapters/ethers/resources/withdrawals/services/finalization.ts
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { AbiCoder, Contract, type TransactionReceipt } from 'ethers';

import type { Address, Hex } from '../../../../../core/types/primitives';
import type { EthersClient } from '../../../client';
import {
  type FinalizeDepositParams,
  type WithdrawalKey,
} from '../../../../../core/types/flows/withdrawals';

import IL1NullifierABI from '../../../../../internal/abis/IL1Nullifier.json' assert { type: 'json' };

// core constants + helpers
import { L2_ASSET_ROUTER_ADDR, L1_MESSENGER_ADDRESS } from '../../../../../core/constants';
import { findL1MessageSentLog } from '../../../../../core/withdrawals/events';
import { messengerLogIndex } from '../../../../../core/withdrawals/logs';

const IL1NullifierMini = [
  'function isWithdrawalFinalized(uint256,uint256,uint256) view returns (bool)',
] as const;

export interface FinalizationServices {
  /**
   * Build finalizeDeposit params (mirrors the Rust e2e).
   */
  fetchFinalizeDepositParams(
    l2TxHash: Hex,
  ): Promise<{ params: FinalizeDepositParams; nullifier: Address }>;

  /**
   * Read the Nullifier mapping to check finalization status.
   */
  isWithdrawalFinalized(key: WithdrawalKey): Promise<boolean>;

  /**
   * Send finalizeDeposit on L1 Nullifier (signer-bound).
   */
  finalizeDeposit(
    params: FinalizeDepositParams,
    nullifier: Address,
  ): Promise<{ hash: string; wait: () => Promise<TransactionReceipt> }>;
}

export function createFinalizationServices(client: EthersClient): FinalizationServices {
  const { l1, l2, signer } = client;

  return {
    async fetchFinalizeDepositParams(l2TxHash: Hex) {
      // 1) Parsed L2 receipt → find L1MessageSent(...) → decode message bytes
      const parsed = await client.zks.getReceiptWithL2ToL1(l2TxHash);
      if (!parsed) throw new Error('L2 receipt not found');

      const ev = findL1MessageSentLog(parsed as any, {
        index: 0,
      });
      const message = AbiCoder.defaultAbiCoder().decode(['bytes'], ev.data)[0] as Hex;

      // 2) Raw receipt → messenger entry index → proof
      const raw = await client.zks.getReceiptWithL2ToL1(l2TxHash);
      if (!raw) throw new Error('Raw L2 receipt not found');

      const idx = messengerLogIndex(raw, {
        index: 0,
        messenger: L1_MESSENGER_ADDRESS,
      });

      const proof = await client.zks.getL2ToL1LogProof(l2TxHash, idx);

      const { chainId } = await l2.getNetwork();
      const txIndex = Number((parsed as any).transactionIndex ?? 0);

      const params: FinalizeDepositParams = {
        chainId: BigInt(chainId),
        l2BatchNumber: proof.batchNumber,
        l2MessageIndex: proof.id,
        l2Sender: L2_ASSET_ROUTER_ADDR,
        l2TxNumberInBatch: txIndex,
        message,
        merkleProof: proof.proof,
      };

      const { nullifier } = await client.ensureAddresses();
      return { params, nullifier };
    },

    async isWithdrawalFinalized(key: WithdrawalKey) {
      const { nullifier } = await client.ensureAddresses();
      const c = new Contract(nullifier, IL1NullifierMini, l1);
      return await c.isWithdrawalFinalized(key.chainIdL2, key.l2BatchNumber, key.l2MessageIndex);
    },

    async finalizeDeposit(params: FinalizeDepositParams, nullifier: Address) {
      // signer-bound for write
      const c = new Contract(nullifier, IL1NullifierABI as any, signer);
      const tx = await c.finalizeDeposit(params);
      return { hash: tx.hash, wait: () => tx.wait() };
    },
  };
}
