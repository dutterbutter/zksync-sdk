// src/adapters/viem/resources/withdrawals/routes/eth.ts

import type { WithdrawRouteStrategy, ViemPlanWriteRequest } from './types';
import type { PlanStep } from '../../../../../core/types/flows/base';

import { L2_BASE_TOKEN_ADDRESS } from '../../../../../core/constants';
import { IBaseTokenABI } from '../../../../../core/internal/abi-registry.ts';

import { createErrorHandlers } from '../../../errors/error-ops';
import { OP_WITHDRAWALS } from '../../../../../core/types';

const { wrapAs } = createErrorHandlers('withdrawals');

// Route for withdrawing ETH via L2-L1
export function routeEthBase(): WithdrawRouteStrategy {
  return {
    async build(p, ctx) {
      const toL1 = p.to ?? ctx.sender;
      const { gasLimit: overrideGasLimit, maxFeePerGas, maxPriorityFeePerGas } = ctx.fee;

      const simulateOverrides: Record<string, unknown> = {};
      if (maxFeePerGas != null) simulateOverrides.maxFeePerGas = maxFeePerGas;
      if (maxPriorityFeePerGas != null) {
        simulateOverrides.maxPriorityFeePerGas = maxPriorityFeePerGas;
      }
      if (overrideGasLimit != null) simulateOverrides.gas = overrideGasLimit;

      // Simulate the L2 call to produce a write-ready request
      const sim = await wrapAs(
        'CONTRACT',
        OP_WITHDRAWALS.eth.estGas,
        () =>
          ctx.client.l2.simulateContract({
            address: L2_BASE_TOKEN_ADDRESS,
            abi: IBaseTokenABI,
            functionName: 'withdraw',
            args: [toL1] as const,
            value: p.amount,
            account: ctx.client.account,
            ...simulateOverrides,
          }),
        {
          ctx: { where: 'l2.simulateContract', to: L2_BASE_TOKEN_ADDRESS },
          message: 'Failed to simulate L2 ETH withdraw.',
        },
      );

      const requestOverrides: Record<string, unknown> = {};
      if (maxFeePerGas != null) requestOverrides.maxFeePerGas = maxFeePerGas;
      if (maxPriorityFeePerGas != null) {
        requestOverrides.maxPriorityFeePerGas = maxPriorityFeePerGas;
      }
      if (overrideGasLimit != null) requestOverrides.gas = overrideGasLimit;

      const steps: Array<PlanStep<ViemPlanWriteRequest>> = [
        {
          key: 'l2-base-token:withdraw',
          kind: 'l2-base-token:withdraw',
          description: 'Withdraw ETH via L2 Base Token System',
          tx: { ...(sim.request as ViemPlanWriteRequest), ...requestOverrides },
        },
      ];

      return { steps, approvals: [], quoteExtras: {} };
    },
  };
}
