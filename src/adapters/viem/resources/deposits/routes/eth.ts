// src/adapters/viem/resources/deposits/routes/eth.ts

import type { DepositRouteStrategy, ViemPlanWriteRequest } from './types';
import type { PlanStep } from '../../../../../core/types/flows/base';
import { buildDirectRequestStruct } from '../../utils';
import { IBridgehubABI } from '../../../../../core/internal/abi-registry.ts';
import { createErrorHandlers } from '../../../errors/error-ops';
import { OP_DEPOSITS } from '../../../../../core/types';
import type { Address } from '../../../../../core/types/primitives.ts';

// error handling
const { wrapAs } = createErrorHandlers('deposits');

// ETH deposit route via Bridgehub.requestL2TransactionDirect
// ETH is base token
export function routeEthDirect(): DepositRouteStrategy {
  return {
    async build(p, ctx) {
      const sender = ctx.sender;
      // base cost
      const rawBaseCost = await wrapAs(
        'CONTRACT',
        OP_DEPOSITS.eth.baseCost,
        () =>
          ctx.client.l1.readContract({
            address: ctx.bridgehub,
            abi: IBridgehubABI,
            functionName: 'l2TransactionBaseCost',
            args: [ctx.chainIdL2, ctx.fee.gasPriceForBaseCost, ctx.l2GasLimit, ctx.gasPerPubdata],
          }),
        {
          ctx: { where: 'l2TransactionBaseCost', chainIdL2: ctx.chainIdL2 },
          message: 'Could not fetch L2 base cost from Bridgehub.',
        },
      );
      const baseCost = rawBaseCost;

      const l2Contract = (p.to ?? sender) as Address | undefined;
      if (!l2Contract) {
        throw new Error(
          'Deposits require a target L2 address. Provide params.to when no sender account is available.',
        );
      }
      const l2Value = p.amount;
      const baseCostQuote = ctx.gas.applyBaseCost(
        'base-cost:bridgehub:direct',
        'deposit.base-cost.eth-base',
        baseCost,
        { operatorTip: ctx.operatorTip, extras: l2Value },
      );
      const mintValue = baseCostQuote.recommended;

      const req = buildDirectRequestStruct({
        chainId: ctx.chainIdL2,
        mintValue,
        l2GasLimit: ctx.l2GasLimit,
        gasPerPubdata: ctx.gasPerPubdata,
        refundRecipient: ctx.refundRecipient,
        l2Contract,
        l2Value,
      });

      // Optional fee overrides for simulate/write
      // viem client requires these to be explicitly set
      const feeOverrides: Record<string, unknown> = {};
      if ('maxFeePerGas' in ctx.fee && ctx.fee.maxFeePerGas != null) {
        feeOverrides.maxFeePerGas = ctx.fee.maxFeePerGas;
      }
      if ('maxPriorityFeePerGas' in ctx.fee && ctx.fee.maxPriorityFeePerGas != null) {
        feeOverrides.maxPriorityFeePerGas = ctx.fee.maxPriorityFeePerGas;
      }
      if ('gasPrice' in ctx.fee && ctx.fee.gasPrice != null) {
        feeOverrides.gasPrice = ctx.fee.gasPrice;
      }

      // Simulate to produce a writeContract-ready request
      const callParams = {
        address: ctx.bridgehub,
        abi: IBridgehubABI,
        functionName: 'requestL2TransactionDirect',
        args: [req],
        value: mintValue,
        account: ctx.client.account,
        ...feeOverrides,
      } as const;

      const sim = await wrapAs(
        'RPC',
        OP_DEPOSITS.eth.estGas,
        () => ctx.client.l1.simulateContract(callParams),
        {
          ctx: { where: 'l1.simulateContract', to: ctx.bridgehub },
          message: 'Failed to simulate Bridgehub.requestL2TransactionDirect.',
        },
      );
      // TODO: add preview step
      // right now it adds too much noise on response
      const tx = sim.request as ViemPlanWriteRequest;

      const gas = await ctx.gas.ensure('bridgehub:direct', 'deposit.bridgehub.direct.l1', tx, {
        estimator: () =>
          wrapAs(
            'RPC',
            OP_DEPOSITS.eth.estGas,
            () => ctx.client.l1.estimateContractGas(callParams),
            {
              ctx: { where: 'l1.estimateContractGas', to: ctx.bridgehub },
              message: 'Failed to estimate gas for Bridgehub request.',
            },
          ),
      });
      if (gas.recommended != null) {
        tx.gas = gas.recommended;
      }

      const steps: PlanStep<ViemPlanWriteRequest>[] = [
        {
          key: 'bridgehub:direct',
          kind: 'bridgehub:direct',
          description: 'Bridge ETH via Bridgehub.requestL2TransactionDirect',
          tx,
        },
      ];

      return {
        steps,
        approvals: [],
        quoteExtras: { baseCost, mintValue, gasPlan: ctx.gas.snapshot() },
      };
    },
  };
}
