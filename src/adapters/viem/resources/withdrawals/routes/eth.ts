// src/adapters/viem/resources/withdrawals/routes/eth.ts

import type { WithdrawRouteStrategy, ViemPlanWriteRequest } from './types';
import type { PlanStep } from '../../../../../core/types/flows/base';

import { L2_BASE_TOKEN_SYSTEM_CONTRACT_ADDR } from '../../../../../core/constants';
import L2BaseTokenABI from '../../../../../internal/abis/IBaseToken.json' assert { type: 'json' };

import { createErrorHandlers } from '../../../errors/error-ops';
import { OP_WITHDRAWALS } from '../../../../../core/types';

const { wrapAs } = createErrorHandlers('withdrawals');

// Withdraw ETH from L2 → L1 via Base Token System
export function routeEth(): WithdrawRouteStrategy {
  return {
    async build(p, ctx) {
      const toL1 = p.to ?? ctx.sender;

      // Prefer 1559 fields (don’t send gasPrice)
      const feeOverrides: Record<string, unknown> = {};
      if (ctx.fee?.maxFeePerGas != null && ctx.fee?.maxPriorityFeePerGas != null) {
        feeOverrides.maxFeePerGas = ctx.fee.maxFeePerGas;
        feeOverrides.maxPriorityFeePerGas = ctx.fee.maxPriorityFeePerGas;
      }

      // Simulate the L2 call to produce a write-ready request (auto gas pick-up)
      const sim = await wrapAs(
        'CONTRACT',
        OP_WITHDRAWALS.eth.estGas,
        () =>
          ctx.client.l2.simulateContract({
            address: L2_BASE_TOKEN_SYSTEM_CONTRACT_ADDR,
            abi: L2BaseTokenABI,
            functionName: 'withdraw',
            args: [toL1] as const,
            value: p.amount,                 // payable: amount to withdraw
            account: ctx.client.account,     // signer/account
            ...feeOverrides,                 // 1559 overrides if provided
          }),
        {
          ctx: { where: 'l2.simulateContract', to: L2_BASE_TOKEN_SYSTEM_CONTRACT_ADDR },
          message: 'Failed to simulate L2 ETH withdraw.',
        },
      );

      const steps: Array<PlanStep<ViemPlanWriteRequest>> = [
        {
          key: 'l2-base-token:withdraw',
          kind: 'l2-base-token:withdraw',
          description: 'Withdraw ETH via L2 Base Token System',
          tx: sim.request as unknown as ViemPlanWriteRequest,
        },
      ];

      return { steps, approvals: [], quoteExtras: {} };
    },
  };
}
