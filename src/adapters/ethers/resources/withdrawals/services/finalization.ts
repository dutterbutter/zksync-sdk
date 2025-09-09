/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
// src/adapters/ethers/resources/withdrawals/services/finalization.ts
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { AbiCoder, Contract, Interface, type TransactionReceipt } from 'ethers';

import type { Address, Hex } from '../../../../../core/types/primitives';
import type { EthersClient } from '../../../client';
import {
  type FinalizeReadiness,
  type FinalizeDepositParams,
  type WithdrawalKey,
} from '../../../../../core/types/flows/withdrawals';

import IL1NullifierABI from '../../../../../internal/abis/IL1Nullifier.json' assert { type: 'json' };

import { L2_ASSET_ROUTER_ADDR, L1_MESSENGER_ADDRESS } from '../../../../../core/constants';
import { findL1MessageSentLog } from '../../../../../core/withdrawals/events';
import { messengerLogIndex } from '../../../../../core/withdrawals/logs';

const IL1NullifierMini = [
  'function isWithdrawalFinalized(uint256,uint256,uint256) view returns (bool)',
] as const;
const NullifierIface = new Interface(IL1NullifierABI as any);

export interface FinalizationServices {
  /**
   * Build finalizeDeposit params.
   */
  fetchFinalizeDepositParams(
    l2TxHash: Hex,
  ): Promise<{ params: FinalizeDepositParams; nullifier: Address }>;

  /**
   * Read the Nullifier mapping to check finalization status.
   */
  isWithdrawalFinalized(key: WithdrawalKey): Promise<boolean>;

  simulateFinalizeReadiness(
    params: FinalizeDepositParams,
    nullifier: Address,
  ): Promise<FinalizeReadiness>;

  /**
   * Send finalizeDeposit on L1 Nullifier.
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
      // Parsed L2 receipt → find L1MessageSent(...) → decode message bytes
      const parsed = await client.zks.getReceiptWithL2ToL1(l2TxHash);
      if (!parsed) throw new Error('L2 receipt not found');

      const ev = findL1MessageSentLog(parsed as any, {
        index: 0,
      });
      const message = AbiCoder.defaultAbiCoder().decode(['bytes'], ev.data)[0] as Hex;

      // Raw receipt → messenger entry index → proof
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

      const { l1Nullifier } = await client.ensureAddresses();
      return { params, nullifier: l1Nullifier };
    },

    async simulateFinalizeReadiness(params, nullifier) {
      const done = await (async () => {
        try {
          const { l1Nullifier } = await client.ensureAddresses();
          const c = new Contract(l1Nullifier, IL1NullifierMini, l1);
          return await c.isWithdrawalFinalized(
            params.chainId,
            params.l2BatchNumber,
            params.l2MessageIndex,
          );
        } catch {
          return false;
        }
      })();
      if (done) return { kind: 'FINALIZED' };

      // simulate the finalizeDeposit call on L1
      const c = new Contract(nullifier, IL1NullifierABI as any, l1);
      try {
        await (c as any).finalizeDeposit.staticCall(params);
        return { kind: 'READY' };
      } catch (e: any) {
        // TODO: proper error envelope
        let name: string | undefined;
        try {
          const data = e?.data ?? e?.error?.data;
          const parsed = data ? NullifierIface.parseError(data) : undefined;
          name = parsed?.name;
        } catch {
          /* ignore */
        }

        if (name === 'WithdrawalAlreadyFinalized') return { kind: 'FINALIZED' };
        if (name === 'InvalidProof') return { kind: 'NOT_READY', reason: 'invalid-proof' };

        const msg = (e?.shortMessage ?? e?.message ?? '').toLowerCase();

        if (msg.includes('paused')) return { kind: 'NOT_READY', reason: 'paused' };
        if (msg.includes('sharedbridge'))
          return {
            kind: 'NOT_READY',
            reason: 'config-missing',
            detail: e?.shortMessage ?? e?.message,
          };

        if (name === 'WrongL2Sender' || name === 'InvalidSelector' || name === 'TokenNotLegacy') {
          return { kind: 'NOT_READY', reason: 'message-mismatch', detail: name };
        }

        return { kind: 'NOT_READY', reason: 'unknown', detail: e?.shortMessage ?? e?.message };
      }
    },

    async isWithdrawalFinalized(key: WithdrawalKey) {
      const { l1Nullifier } = await client.ensureAddresses();
      const c = new Contract(l1Nullifier, IL1NullifierMini, l1);
      return await c.isWithdrawalFinalized(key.chainIdL2, key.l2BatchNumber, key.l2MessageIndex);
    },

    async finalizeDeposit(params: FinalizeDepositParams, nullifier: Address) {
      const c = new Contract(nullifier, IL1NullifierABI as any, signer);
      const tx = await c.finalizeDeposit(params);
      return { hash: tx.hash, wait: () => tx.wait() };
    },
  };
}
