// src/adapters/ethers/resources/withdrawals/routes/eth.ts
import { Contract, Interface, type TransactionRequest } from 'ethers';
import type { WithdrawRouteStrategy } from './types';
import type { PlanStep } from '../../../../../core/types/flows/base';
import { L2_BASE_TOKEN_ADDRESS } from '../../../../../core/constants';
import { IBaseTokenABI } from '../../../../../core/internal/abi-registry.ts';
import type { Address } from '../../../../../core/types/primitives.ts';

import { createErrorHandlers } from '../../../errors/error-ops';
import { OP_WITHDRAWALS } from '../../../../../core/types';

const { wrapAs } = createErrorHandlers('withdrawals');

// Route for withdrawing ETH via L2-L1
export function routeEthBase(): WithdrawRouteStrategy {
  return {
    async build(p, ctx) {
      const steps: Array<PlanStep<TransactionRequest>> = [];
      const sender = ctx.sender;

      const base = new Contract(
        L2_BASE_TOKEN_ADDRESS,

        new Interface(IBaseTokenABI),
        ctx.client.l2,
      );

      const toL1 = (p.to ?? sender) as Address | undefined;
      if (!toL1) {
        throw new Error(
          'Withdrawals require a destination address. Provide params.to when no sender account is available.',
        );
      }
      const data = await wrapAs(
        'INTERNAL',
        OP_WITHDRAWALS.eth.encodeWithdraw,
        () => Promise.resolve(base.interface.encodeFunctionData('withdraw', [toL1])),
        {
          ctx: { where: 'L2BaseToken.withdraw', to: toL1 },
          message: 'Failed to encode ETH withdraw calldata.',
        },
      );

      const tx: TransactionRequest = {
        to: L2_BASE_TOKEN_ADDRESS,
        data,
        value: p.amount,
      };
      if (sender) {
        tx.from = sender;
      }

      const gas = await ctx.gas.ensure('l2-base-token:withdraw', 'withdraw.eth-base.l2', tx, {
        estimator: (request) =>
          wrapAs('RPC', OP_WITHDRAWALS.eth.estGas, () => ctx.client.l2.estimateGas(request), {
            ctx: { where: 'l2.estimateGas', to: L2_BASE_TOKEN_ADDRESS },
            message: 'Failed to estimate gas for L2 ETH withdraw.',
          }),
      });
      if (gas.recommended != null) {
        tx.gasLimit = gas.recommended;
      }

      steps.push({
        key: 'l2-base-token:withdraw',
        kind: 'l2-base-token:withdraw',
        description: 'Withdraw ETH via L2 Base Token System',
        tx,
      });

      return { steps, approvals: [], quoteExtras: { gasPlan: ctx.gas.snapshot() } };
    },
  };
}
