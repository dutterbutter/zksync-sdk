// src/adapters/ethers/resources/withdrawals/routes/erc20-nonbase.ts

import { AbiCoder, Contract, type TransactionRequest } from 'ethers';
import type { WithdrawRouteStrategy } from './types';
import type { PlanStep, ApprovalNeed } from '../../../../../core/types/flows/base';
import {
  IL2AssetRouterABI,
  L2NativeTokenVaultABI,
  IERC20ABI,
} from '../../../../../core/internal/abi-registry';
import type { Address } from '../../../../../core/types/primitives';

import { createErrorHandlers } from '../../../errors/error-ops';
import { OP_WITHDRAWALS } from '../../../../../core/types';

const { wrapAs } = createErrorHandlers('withdrawals');

// Strongly-typed signatures for overloaded functions
// Necessary for ethers v6 when contract has multiple functions with same name
// which is the case for L2AssetRouter.withdraw
const SIG = {
  withdraw: 'withdraw(bytes32,bytes)',
} as const;

// Route for withdrawing ERC-20 via L2-L1
export function routeErc20NonBase(): WithdrawRouteStrategy {
  return {
    async build(p, ctx) {
      const steps: Array<PlanStep<TransactionRequest>> = [];
      const approvals: ApprovalNeed[] = [];
      const sender = ctx.sender;

      // L2 allowance
      const erc20 = new Contract(p.token, IERC20ABI, ctx.client.l2);
      let current: bigint | undefined;
      if (sender) {
        current = (await wrapAs(
          'CONTRACT',
          OP_WITHDRAWALS.erc20.allowance,
          () => erc20.allowance(sender, ctx.l2NativeTokenVault),
          {
            ctx: {
              where: 'erc20.allowance',
              chain: 'L2',
              token: p.token,
              spender: ctx.l2NativeTokenVault,
            },
            message: 'Failed to read L2 ERC-20 allowance.',
          },
        )) as bigint;
      }

      if (current == null || current < p.amount) {
        approvals.push({ token: p.token, spender: ctx.l2NativeTokenVault, amount: p.amount });

        const data = erc20.interface.encodeFunctionData('approve', [
          ctx.l2NativeTokenVault,
          p.amount,
        ]);

        const approveTx: TransactionRequest = {
          to: p.token,
          data,
          ...(ctx.fee ?? {}),
        };
        if (sender) {
          approveTx.from = sender;
        }

        const approveGas = await ctx.gas.ensure(
          `approve:l2:${p.token}:${ctx.l2NativeTokenVault}`,
          'withdraw.approval.l2',
          approveTx,
          {
            estimator: (request) =>
              wrapAs('RPC', OP_WITHDRAWALS.erc20.estGas, () => ctx.client.l2.estimateGas(request), {
                ctx: { where: 'l2.estimateGas', to: p.token },
                message: 'Failed to estimate gas for L2 ERC-20 approval.',
              }),
          },
        );
        if (approveGas.recommended != null) {
          approveTx.gasLimit = approveGas.recommended;
        }

        steps.push({
          key: `approve:l2:${p.token}:${ctx.l2NativeTokenVault}`,
          kind: 'approve:l2',
          description: `Approve ${p.amount} to NativeTokenVault`,
          tx: approveTx,
        });
      }

      // Compute assetId + assetData
      const ntv = new Contract(ctx.l2NativeTokenVault, L2NativeTokenVaultABI, ctx.client.l2);
      const assetId = (await wrapAs(
        'CONTRACT',
        OP_WITHDRAWALS.erc20.ensureRegistered,
        () => ntv.getFunction('ensureTokenIsRegistered').staticCall(p.token),
        {
          ctx: { where: 'L2NativeTokenVault.ensureTokenIsRegistered', token: p.token },
          message: 'Failed to ensure token is registered in L2NativeTokenVault.',
        },
      )) as `0x${string}`;

      const recipient = (p.to ?? sender) as Address | undefined;
      if (!recipient) {
        throw new Error(
          'Withdrawals require a destination address. Provide params.to when no sender account is available.',
        );
      }
      const assetData = await wrapAs(
        'INTERNAL',
        OP_WITHDRAWALS.erc20.encodeAssetData,
        () =>
          Promise.resolve(
            AbiCoder.defaultAbiCoder().encode(
              ['uint256', 'address', 'address'],
              [p.amount, recipient, p.token],
            ),
          ),
        {
          ctx: { where: 'AbiCoder.encode', token: p.token, to: recipient },
          message: 'Failed to encode burn/withdraw asset data.',
        },
      );

      // L2AssetRouter.withdraw(assetId, assetData)
      const l2ar = new Contract(ctx.l2AssetRouter, IL2AssetRouterABI, ctx.client.l2);
      const dataWithdraw = await wrapAs(
        'INTERNAL',
        OP_WITHDRAWALS.erc20.encodeWithdraw,
        () =>
          Promise.resolve(l2ar.interface.encodeFunctionData(SIG.withdraw, [assetId, assetData])),
        {
          ctx: { where: 'L2AssetRouter.withdraw', assetId },
          message: 'Failed to encode withdraw calldata.',
        },
      );

      const withdrawTx: TransactionRequest = {
        to: ctx.l2AssetRouter,
        data: dataWithdraw,
        ...(ctx.fee ?? {}),
      };
      if (sender) {
        withdrawTx.from = sender;
      }

      const withdrawGas = await ctx.gas.ensure(
        'l2-asset-router:withdraw',
        'withdraw.erc20-nonbase.l2',
        withdrawTx,
        {
          estimator: (request) =>
            wrapAs('RPC', OP_WITHDRAWALS.erc20.estGas, () => ctx.client.l2.estimateGas(request), {
              ctx: { where: 'l2.estimateGas', to: ctx.l2AssetRouter },
              message: 'Failed to estimate gas for L2 asset-router withdraw.',
            }),
        },
      );
      if (withdrawGas.recommended != null) {
        withdrawTx.gasLimit = withdrawGas.recommended;
      }

      steps.push({
        key: 'l2-asset-router:withdraw',
        kind: 'l2-asset-router:withdraw',
        description: 'Burn on L2 & send L2→L1 message',
        tx: withdrawTx,
      });

      return { steps, approvals, quoteExtras: { gasPlan: ctx.gas.snapshot() } };
    },
  };
}
