// src/adapters/viem/resources/withdrawals/routes/eth-nonbase.ts
import type { WithdrawRouteStrategy, ViemPlanWriteRequest } from './types';
import type { PlanStep } from '../../../../../core/types/flows/base';
import { L2_BASE_TOKEN_ADDRESS } from '../../../../../core/constants';
import { IBaseTokenABI } from '../../../../../core/internal/abi-registry';
import { createErrorHandlers } from '../../../errors/error-ops';
import { OP_WITHDRAWALS } from '../../../../../core/types';

const { wrapAs } = createErrorHandlers('withdrawals');

// Withdraw the chain's base token (on a non-ETH-based chain) via BaseTokenSystem.withdraw
export function routeEthNonBase(): WithdrawRouteStrategy {
  return {
    async preflight(p, ctx) {
      await wrapAs(
        'VALIDATION',
        OP_WITHDRAWALS.ethNonBase.assertNonEthBase,
        () => {
          // Must be the base-token system alias (0x…800A)
          if (p.token.toLowerCase() !== L2_BASE_TOKEN_ADDRESS.toLowerCase()) {
            throw new Error('eth-nonbase route requires the L2 base-token alias (0x…800A).');
          }
          // Chain’s base must not be ETH
          if (ctx.baseIsEth) {
            throw new Error('eth-nonbase route requires chain base ≠ ETH.');
          }
        },
        { ctx: { token: p.token, baseIsEth: ctx.baseIsEth } },
      );
    },

    async build(p, ctx) {
      const toL1 = p.to ?? ctx.sender;

      const feeOverrides: Record<string, unknown> = {};
      if (ctx.fee?.maxFeePerGas != null) feeOverrides.maxFeePerGas = ctx.fee.maxFeePerGas;
      if (ctx.fee?.maxPriorityFeePerGas != null)
        feeOverrides.maxPriorityFeePerGas = ctx.fee.maxPriorityFeePerGas;

      const callParams = {
        address: L2_BASE_TOKEN_ADDRESS,
        abi: IBaseTokenABI,
        functionName: 'withdraw',
        args: [toL1] as const,
        value: p.amount,
        account: ctx.client.account,
        ...feeOverrides,
      } as const;

      const sim = await wrapAs(
        'CONTRACT',
        OP_WITHDRAWALS.ethNonBase.estGas,
        () => ctx.client.l2.simulateContract(callParams),
        {
          ctx: { where: 'l2.simulateContract', to: L2_BASE_TOKEN_ADDRESS },
          message: 'Failed to simulate L2 base-token withdraw.',
        },
      );

      const tx = sim.request as ViemPlanWriteRequest;
      const gas = await ctx.gas.ensure('l2-base-token:withdraw', 'withdraw.eth-nonbase.l2', tx, {
        estimator: () =>
          wrapAs(
            'RPC',
            OP_WITHDRAWALS.ethNonBase.estGas,
            () => ctx.client.l2.estimateContractGas(callParams),
            {
              ctx: { where: 'l2.estimateContractGas', to: L2_BASE_TOKEN_ADDRESS },
              message: 'Failed to estimate gas for base-token withdraw.',
            },
          ),
      });
      if (gas.recommended != null) {
        tx.gas = gas.recommended;
      }

      const steps: Array<PlanStep<ViemPlanWriteRequest>> = [
        {
          key: 'l2-base-token:withdraw',
          kind: 'l2-base-token:withdraw',
          description: 'Withdraw base token via L2 Base Token System (base ≠ ETH)',
          tx,
        },
      ];

      return { steps, approvals: [], quoteExtras: { gasPlan: ctx.gas.snapshot() } };
    },
  };
}
