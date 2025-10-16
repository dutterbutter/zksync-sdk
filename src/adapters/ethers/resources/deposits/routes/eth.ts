// src/adapters/ethers/resources/deposits/routes/eth.ts

import type { DepositRouteStrategy } from './types';
import { Contract } from 'ethers';
import type { TransactionRequest } from 'ethers';
import { buildDirectRequestStruct } from '../../utils';
import { IBridgehubABI } from '../../../../../core/internal/abi-registry.ts';
import type { PlanStep } from '../../../../../core/types/flows/base';
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
      const bh = new Contract(ctx.bridgehub, IBridgehubABI, ctx.client.l1);
      const sender = ctx.sender;

      // base cost
      const rawBaseCost: bigint = (await wrapAs(
        'CONTRACT',
        OP_DEPOSITS.eth.baseCost,
        () =>
          bh.l2TransactionBaseCost(
            ctx.chainIdL2,
            ctx.fee.gasPriceForBaseCost,
            ctx.l2GasLimit,
            ctx.gasPerPubdata,
          ),
        {
          ctx: { where: 'l2TransactionBaseCost', chainIdL2: ctx.chainIdL2 },
          message: 'Could not fetch L2 base cost from Bridgehub.',
        },
      )) as bigint;
      const baseCost = BigInt(rawBaseCost);

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

      const data = bh.interface.encodeFunctionData('requestL2TransactionDirect', [req]);
      const tx: TransactionRequest = {
        to: ctx.bridgehub,
        data,
        value: mintValue,
        ...ctx.fee,
      };
      if (sender) {
        tx.from = sender;
      }
      const gas = await ctx.gas.ensure('bridgehub:direct', 'deposit.bridgehub.direct.l1', tx, {
        estimator: (request) =>
          wrapAs('RPC', OP_DEPOSITS.eth.estGas, () => ctx.client.l1.estimateGas(request), {
            ctx: { where: 'l1.estimateGas', to: ctx.bridgehub },
            message: 'Failed to estimate gas for Bridgehub request.',
          }),
      });
      if (gas.recommended != null) {
        tx.gasLimit = gas.recommended;
      }

      const steps: PlanStep<TransactionRequest>[] = [
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
