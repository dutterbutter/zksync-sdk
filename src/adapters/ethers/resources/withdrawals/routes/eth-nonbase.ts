// src/adapters/ethers/resources/withdrawals/routes/eth-nonbase.ts
import { Interface, type TransactionRequest } from 'ethers';
import type { WithdrawRouteStrategy } from './types';
import type { PlanStep } from '../../../../../core/types/flows/base';
import { L2_BASE_TOKEN_ADDRESS } from '../../../../../core/constants';
import { IBaseTokenABI } from '../../../../../core/internal/abi-registry.ts';
import { createErrorHandlers } from '../../../errors/error-ops';
import { OP_WITHDRAWALS } from '../../../../../core/types';
import type { Address } from '../../../../../core/types/primitives.ts';

const { wrapAs } = createErrorHandlers('withdrawals');

// Withdraw the chain's base token on a non-ETH-based chain.
export function routeEthNonBase(): WithdrawRouteStrategy {
  return {
    async preflight(p, ctx) {
      await wrapAs(
        'VALIDATION',
        OP_WITHDRAWALS.ethNonBase.assertNonEthBase,
        () => {
          if (p.token.toLowerCase() !== L2_BASE_TOKEN_ADDRESS.toLowerCase()) {
            throw new Error('eth-nonbase route requires the L2 base-token alias (0x…800A).');
          }
          if (ctx.baseIsEth) {
            throw new Error('eth-nonbase route requires chain base ≠ ETH.');
          }
        },
        { ctx: { token: p.token, baseIsEth: ctx.baseIsEth } },
      );
    },

    async build(p, ctx) {
      const steps: Array<PlanStep<TransactionRequest>> = [];
      const sender = ctx.sender;

      const toL1 = (p.to ?? sender) as Address | undefined;
      if (!toL1) {
        throw new Error(
          'Withdrawals require a destination address. Provide params.to when no sender account is available.',
        );
      }
      const iface = new Interface(IBaseTokenABI);
      const data = await wrapAs(
        'INTERNAL',
        OP_WITHDRAWALS.eth.encodeWithdraw, // reuse label for base-token system call
        () => Promise.resolve(iface.encodeFunctionData('withdraw', [toL1])),
        { ctx: { where: 'L2BaseToken.withdraw', to: toL1 } },
      );

      const tx: TransactionRequest = {
        to: L2_BASE_TOKEN_ADDRESS,
        data,
        value: p.amount,
        ...(ctx.fee ?? {}),
      };
      if (sender) {
        tx.from = sender;
      }

      const gas = await ctx.gas.ensure('l2-base-token:withdraw', 'withdraw.eth-nonbase.l2', tx, {
        estimator: (request) =>
          wrapAs('RPC', OP_WITHDRAWALS.eth.estGas, () => ctx.client.l2.estimateGas(request), {
            ctx: { where: 'l2.estimateGas', to: L2_BASE_TOKEN_ADDRESS },
            message: 'Failed to estimate gas for L2 base-token withdraw.',
          }),
      });
      if (gas.recommended != null) {
        tx.gasLimit = gas.recommended;
      }

      steps.push({
        key: 'l2-base-token:withdraw',
        kind: 'l2-base-token:withdraw',
        description: 'Withdraw base token via L2 Base Token System (base ≠ ETH)',
        tx,
      });

      return { steps, approvals: [], quoteExtras: { gasPlan: ctx.gas.snapshot() } };
    },
  };
}
