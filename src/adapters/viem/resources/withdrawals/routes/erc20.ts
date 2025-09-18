// src/adapters/viem/resources/withdrawals/routes/erc20.ts

import type { WithdrawRouteStrategy, ViemPlanWriteRequest } from './types';
import type { PlanStep } from '../../../../../core/types/flows/base';

import IL2AssetRouterABI from '../../../../../internal/abis/IL2AssetRouter.json' assert { type: 'json' };
import { createErrorHandlers } from '../../../errors/error-ops';
import { OP_WITHDRAWALS } from '../../../../../core/types';

const { wrapAs } = createErrorHandlers('withdrawals');

// Withdraw ERC20 from L2 → L1 via L2 Asset Router
export function routeErc20(): WithdrawRouteStrategy {
  return {
    async build(p, ctx) {
      const toL1 = p.to ?? ctx.sender;

      // Prefer 1559 fee fields (never send gasPrice)
      const feeOverrides: Record<string, unknown> = {};
      if (ctx.fee?.maxFeePerGas != null && ctx.fee?.maxPriorityFeePerGas != null) {
        feeOverrides.maxFeePerGas = ctx.fee.maxFeePerGas;
        feeOverrides.maxPriorityFeePerGas = ctx.fee.maxPriorityFeePerGas;
      }

      // Simulate L2 router call to produce a write-ready request (auto gas pick-up)
      const sim = await wrapAs(
        'CONTRACT',
        OP_WITHDRAWALS.erc20.estGas,
        () =>
          ctx.client.l2.simulateContract({
            address: ctx.l2AssetRouter,
            abi: IL2AssetRouterABI,
            functionName: 'withdraw',        // adjust if your ABI uses a different name/signature
            args: [p.token, toL1, p.amount],
            account: ctx.client.account,
            ...feeOverrides,
          }),
        {
          ctx: { where: 'l2.simulateContract', to: ctx.l2AssetRouter },
          message: 'Failed to simulate L2 ERC-20 withdraw.',
        },
      );

      const steps: Array<PlanStep<ViemPlanWriteRequest>> = [
        {
          key: 'l2-asset-router:withdraw-erc20',
          kind: 'l2-asset-router:withdraw-erc20',
          description: 'Withdraw ERC-20 via L2 Asset Router',
          tx: sim.request as unknown as ViemPlanWriteRequest,
        },
      ];

      return { steps, approvals: [], quoteExtras: {} };
    },
  };
}
