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
  type FinalizeReadiness,
  type FinalizeDepositParams,
  type WithdrawalKey,
} from '../../../../../core/types/flows/withdrawals';

import IL1NullifierABI from '../../../../../internal/abis/IL1Nullifier.json' assert { type: 'json' };

import { L2_ASSET_ROUTER_ADDR, L1_MESSENGER_ADDRESS } from '../../../../../core/constants';
import { findL1MessageSentLog } from '../../../../../core/withdrawals/events';
import { messengerLogIndex } from '../../../../../core/withdrawals/logs';
import { makeErrorOps } from '../../../errors/to-zksync-error';
import { classifyReadinessFromRevert } from '../../../errors/revert';
const { withRouteOp } = makeErrorOps('withdrawals');
import { OP_WITHDRAWALS } from '../../../../../core/types';
import { createError } from '../../../../../core/errors/factory';
import { toZKsyncError } from '../../../errors/to-zksync-error';

const IL1NullifierMini = [
  'function isWithdrawalFinalized(uint256,uint256,uint256) view returns (bool)',
] as const;

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
      const parsed = await withRouteOp(
        'RPC',
        OP_WITHDRAWALS.finalize.fetchParams.receipt,
        'Failed to fetch L2 receipt (with L2→L1 logs).',
        { l2TxHash },
        () => client.zks.getReceiptWithL2ToL1(l2TxHash),
      );
      if (!parsed) {
        throw createError('STATE', {
          resource: 'withdrawals',
          operation: OP_WITHDRAWALS.finalize.fetchParams.receipt,
          message: 'L2 receipt not found.',
          context: { l2TxHash },
        });
      }

      // Find L1MessageSent event and decode message bytes
      const ev = await withRouteOp(
        'INTERNAL',
        OP_WITHDRAWALS.finalize.fetchParams.findMessage,
        'Failed to locate L1MessageSent event in L2 receipt.',
        { l2TxHash, index: 0 },
        () => Promise.resolve(findL1MessageSentLog(parsed as any, { index: 0 })),
      );

      const message = await withRouteOp(
        'INTERNAL',
        OP_WITHDRAWALS.finalize.fetchParams.decodeMessage,
        'Failed to decode withdrawal message.',
        { abi: 'bytes' },
        () => Promise.resolve(AbiCoder.defaultAbiCoder().decode(['bytes'], ev.data)[0] as Hex),
      );

      // Fetch raw receipt again (unparsed) to derive messenger index
      const raw = await withRouteOp(
        'RPC',
        OP_WITHDRAWALS.finalize.fetchParams.rawReceipt,
        'Failed to fetch raw L2 receipt.',
        { l2TxHash },
        () => client.zks.getReceiptWithL2ToL1(l2TxHash),
      );
      if (!raw) {
        throw createError('STATE', {
          resource: 'withdrawals',
          operation: OP_WITHDRAWALS.finalize.fetchParams.rawReceipt,
          message: 'Raw L2 receipt not found.',
          context: { l2TxHash },
        });
      }

      const idx = await withRouteOp(
        'INTERNAL',
        OP_WITHDRAWALS.finalize.fetchParams.messengerIndex,
        'Failed to derive messenger log index.',
        { index: 0, messenger: L1_MESSENGER_ADDRESS },
        () =>
          Promise.resolve(messengerLogIndex(raw, { index: 0, messenger: L1_MESSENGER_ADDRESS })),
      );

      const proof = await withRouteOp(
        'RPC',
        OP_WITHDRAWALS.finalize.fetchParams.proof,
        'Failed to fetch L2→L1 log proof.',
        { l2TxHash, messengerLogIndex: idx },
        () => client.zks.getL2ToL1LogProof(l2TxHash, idx),
      );

      const { chainId } = await withRouteOp(
        'RPC',
        OP_WITHDRAWALS.finalize.fetchParams.network,
        'Failed to read L2 network.',
        {},
        () => l2.getNetwork(),
      );

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

      const { l1Nullifier } = await withRouteOp(
        'INTERNAL',
        OP_WITHDRAWALS.finalize.fetchParams.ensureAddresses,
        'Failed to ensure L1 Nullifier address.',
        {},
        () => client.ensureAddresses(),
      );
      return { params, nullifier: l1Nullifier };
    },

    async simulateFinalizeReadiness(params, nullifier) {
      const done = await (async () => {
        try {
          const { l1Nullifier } = await withRouteOp(
            'INTERNAL',
            OP_WITHDRAWALS.finalize.readiness.ensureAddresses,
            'Failed to ensure L1 Nullifier address.',
            {},
            () => client.ensureAddresses(),
          );
          const c = new Contract(l1Nullifier, IL1NullifierMini, l1);
          return await withRouteOp(
            'RPC',
            OP_WITHDRAWALS.finalize.readiness.isFinalized,
            'Failed to read finalization status.',
            {
              chainIdL2: params.chainId,
              l2BatchNumber: params.l2BatchNumber,
              l2MessageIndex: params.l2MessageIndex,
            },
            () =>
              c.isWithdrawalFinalized(params.chainId, params.l2BatchNumber, params.l2MessageIndex),
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
      } catch (e) {
        return classifyReadinessFromRevert(e);
      }
    },

    async isWithdrawalFinalized(key: WithdrawalKey) {
      const { l1Nullifier } = await withRouteOp(
        'INTERNAL',
        OP_WITHDRAWALS.finalize.fetchParams.ensureAddresses,
        'Failed to ensure L1 Nullifier address.',
        {},
        () => client.ensureAddresses(),
      );
      const c = new Contract(l1Nullifier, IL1NullifierMini, l1);
      return await withRouteOp(
        'RPC',
        OP_WITHDRAWALS.finalize.isFinalized,
        'Failed to read finalization status.',
        { key },
        () => c.isWithdrawalFinalized(key.chainIdL2, key.l2BatchNumber, key.l2MessageIndex),
      );
    },

    async finalizeDeposit(params: FinalizeDepositParams, nullifier: Address) {
      const c = new Contract(nullifier, IL1NullifierABI as any, signer);
      try {
        const sent = await c.finalizeDeposit(params);
        const hash = sent.hash as string;

        return {
          hash,
          wait: async () => {
            try {
              return await sent.wait();
            } catch (e) {
              // Map wait() failures to EXECUTION with useful context
              throw toZKsyncError(
                'EXECUTION',
                {
                  resource: 'withdrawals',
                  operation: OP_WITHDRAWALS.finalize.wait,
                  message: 'Failed while waiting for finalizeDeposit transaction.',
                  context: { txHash: hash },
                },
                e,
              );
            }
          },
        };
      } catch (e) {
        // Map send failures to EXECUTION; revert data is decoded by toZKsyncError
        throw toZKsyncError(
          'EXECUTION',
          {
            resource: 'withdrawals',
            operation: OP_WITHDRAWALS.finalize.send,
            message: 'Failed to send finalizeDeposit transaction.',
            context: {
              chainIdL2: params.chainId,
              l2BatchNumber: params.l2BatchNumber,
              l2MessageIndex: params.l2MessageIndex,
              nullifier,
            },
          },
          e,
        );
      }
    },
  };
}
