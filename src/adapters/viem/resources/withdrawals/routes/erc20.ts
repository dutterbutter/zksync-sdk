// src/adapters/viem/resources/withdrawals/routes/erc20.ts
import type { WithdrawRouteStrategy, ViemPlanWriteRequest } from './types';
import type { PlanStep, ApprovalNeed } from '../../../../../core/types/flows/base';
import IERC20ABI from '../../../../../core/internal/abis/IERC20.json' assert { type: 'json' };
import L2NativeTokenVaultABI from '../../../../../core/internal/abis/L2NativeTokenVault.json' assert { type: 'json' };
import IL2AssetRouterABI from '../../../../../core/internal/abis/IL2AssetRouter.json' assert { type: 'json' };

import { encodeAbiParameters, type Hex } from 'viem';
import { createErrorHandlers } from '../../../errors/error-ops';
import { OP_WITHDRAWALS } from '../../../../../core/types';

const { wrapAs } = createErrorHandlers('withdrawals');

// Route for withdrawing ERC-20 via L2-L1
export function routeErc20(): WithdrawRouteStrategy {
  return {
    async build(p, ctx) {
      const toL1 = p.to ?? ctx.sender;

      //  L2 allowance
      const current = (await wrapAs(
        'CONTRACT',
        OP_WITHDRAWALS.erc20.allowance,
        () =>
          ctx.client.l2.readContract({
            address: p.token,
            abi: IERC20ABI,
            functionName: 'allowance',
            args: [ctx.sender, ctx.l2NativeTokenVault],
            account: ctx.client.account,
          }),
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

      const needsApprove = current < p.amount;

      const feeOverrides: Record<string, unknown> = {};
      if (ctx.fee?.maxFeePerGas != null && ctx.fee?.maxPriorityFeePerGas != null) {
        feeOverrides.maxFeePerGas = ctx.fee.maxFeePerGas;
        feeOverrides.maxPriorityFeePerGas = ctx.fee.maxPriorityFeePerGas;
      }

      const steps: Array<PlanStep<ViemPlanWriteRequest>> = [];
      const approvals: ApprovalNeed[] = [];

      if (needsApprove) {
        approvals.push({ token: p.token, spender: ctx.l2NativeTokenVault, amount: p.amount });

        const approveSim = await wrapAs(
          'CONTRACT',
          OP_WITHDRAWALS.erc20.estGas,
          () =>
            ctx.client.l2.simulateContract({
              address: p.token,
              abi: IERC20ABI,
              functionName: 'approve',
              args: [ctx.l2NativeTokenVault, p.amount] as const,
              account: ctx.client.account,
              ...feeOverrides,
            }),
          {
            ctx: { where: 'l2.simulateContract', to: p.token },
            message: 'Failed to simulate L2 ERC-20 approve.',
          },
        );

        steps.push({
          key: `approve:l2:${p.token}:${ctx.l2NativeTokenVault}`,
          kind: 'approve:l2',
          description: `Approve ${p.amount} to NativeTokenVault`,
          tx: approveSim.request as ViemPlanWriteRequest,
        });
      }
      // ensure token is registered in L2NativeTokenVault
      const ensure = await wrapAs(
        'CONTRACT',
        OP_WITHDRAWALS.erc20.ensureRegistered,
        () =>
          ctx.client.l2.simulateContract({
            address: ctx.l2NativeTokenVault,
            abi: L2NativeTokenVaultABI,
            functionName: 'ensureTokenIsRegistered',
            args: [p.token] as const,
            account: ctx.client.account,
          }),
        {
          ctx: { where: 'L2NativeTokenVault.ensureTokenIsRegistered', token: p.token },
          message: 'Failed to ensure token is registered in L2NativeTokenVault.',
        },
      );
      const assetId = ensure.result as Hex;
      const assetData = encodeAbiParameters(
        [
          { type: 'uint256', name: 'amount' },
          { type: 'address', name: 'l1Receiver' },
          { type: 'address', name: 'l2Token' },
        ],
        [p.amount, toL1, p.token],
      );

      let withdrawTx: ViemPlanWriteRequest;

      if (needsApprove) {
        // Do NOT simulate (would revert before approve). Return raw write params.
        // viem specific
        withdrawTx = {
          address: ctx.l2AssetRouter,
          abi: IL2AssetRouterABI,
          functionName: 'withdraw',
          args: [assetId, assetData] as const,
          account: ctx.client.account,
          ...(ctx.fee ?? {}),
        } satisfies ViemPlanWriteRequest;
      } else {
        // L2AssetRouter.withdraw(assetId, assetData)
        const sim = await wrapAs(
          'CONTRACT',
          OP_WITHDRAWALS.erc20.estGas,
          () =>
            ctx.client.l2.simulateContract({
              address: ctx.l2AssetRouter,
              abi: IL2AssetRouterABI,
              functionName: 'withdraw',
              args: [assetId, assetData] as const,
              account: ctx.client.account,
              ...feeOverrides,
            }),
          {
            ctx: { where: 'l2.simulateContract', to: ctx.l2AssetRouter },
            message: 'Failed to simulate L2 ERC-20 withdraw.',
          },
        );
        withdrawTx = sim.request as ViemPlanWriteRequest;
      }

      steps.push({
        key: 'l2-asset-router:withdraw',
        kind: 'l2-asset-router:withdraw',
        description: 'Burn on L2 & send L2→L1 message',
        tx: withdrawTx,
      });

      return { steps, approvals, quoteExtras: {} };
    },
  };
}
