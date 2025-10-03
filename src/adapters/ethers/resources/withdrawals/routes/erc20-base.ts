// src/adapters/ethers/resources/withdrawals/routes/erc20-base.ts
import { Contract, Interface, type TransactionRequest } from 'ethers';
import type { WithdrawRouteStrategy } from './types';
import type { PlanStep } from '../../../../../core/types/flows/base';
import { IBaseTokenABI, IBridgehubABI } from '../../../../../core/internal/abi-registry.ts';
import { L2_BASE_TOKEN_ADDRESS } from '../../../../../core/constants';
import { createErrorHandlers } from '../../../errors/error-ops';
import { OP_WITHDRAWALS } from '../../../../../core/types';
import { isETH, normalizeAddrEq } from '../../../../../core/utils/addr';

const { wrapAs } = createErrorHandlers('withdrawals');

export function routeErc20Base(): WithdrawRouteStrategy {
  return {
    async preflight(p, ctx) {
      // base must be ERC-20 (not ETH) and p.token must equal base token
      const bh = new Contract(ctx.bridgehub, IBridgehubABI, ctx.client.l1);
      const baseToken = (await wrapAs(
        'CONTRACT',
        OP_WITHDRAWALS.base.baseToken,
        () => bh.baseToken(ctx.chainIdL2),
        { ctx: { where: 'bridgehub.baseToken', chainIdL2: ctx.chainIdL2 } },
      )) as `0x${string}`;

      await wrapAs(
        'VALIDATION',
        OP_WITHDRAWALS.base.assertErc20Base,
        () => {
          if (isETH(baseToken)) {
            throw new Error(
              'erc20-base withdrawal requires target chain base token to be ERC-20 (not ETH).',
            );
          }
        },
        { ctx: { baseToken } },
      );

      await wrapAs(
        'VALIDATION',
        OP_WITHDRAWALS.base.assertMatches,
        () => {
          if (!normalizeAddrEq(baseToken, p.token)) {
            throw new Error('Provided token is not the base token on target chain.');
          }
        },
        { ctx: { baseToken, provided: p.token } },
      );

      return;
    },

    async build(p, ctx) {
      const steps: Array<PlanStep<TransactionRequest>> = [];

      // L2 base-token system contract path
      const base = new Contract(L2_BASE_TOKEN_ADDRESS, new Interface(IBaseTokenABI), ctx.client.l2);
      const toL1 = p.to ?? ctx.sender;

      // Prefer the explicit (to, amount) signature for ERC-20 base tokens.
      // Ensure your IBaseTokenABI includes it, e.g.:
      //   function withdraw(address _to, uint256 _amount) external;
      const data = await wrapAs(
        'INTERNAL',
        OP_WITHDRAWALS.base.encodeWithdraw,
        () => Promise.resolve(base.interface.encodeFunctionData('withdraw', [toL1, p.amount])),
        {
          ctx: { where: 'L2BaseToken.withdraw(to,amount)', to: toL1, amount: p.amount.toString() },
          message: 'Failed to encode ERC-20 base-token withdraw calldata.',
        },
      );

      const tx: TransactionRequest = {
        to: L2_BASE_TOKEN_ADDRESS,
        data,
        from: ctx.sender,
        value: 0n, // ERC-20 base ⇒ no msg.value
      };

      try {
        const est = await wrapAs(
          'RPC',
          OP_WITHDRAWALS.base.estGas,
          () => ctx.client.l2.estimateGas(tx),
          {
            ctx: { where: 'l2.estimateGas', to: L2_BASE_TOKEN_ADDRESS },
            message: 'Failed to estimate gas for L2 ERC-20 base-token withdraw.',
          },
        );
        tx.gasLimit = (BigInt(est) * 115n) / 100n;
      } catch {
        // ignore
      }

      steps.push({
        key: 'l2-base-token:withdraw:erc20-base',
        kind: 'l2-base-token:withdraw',
        description: 'Withdraw base ERC-20 via L2 Base Token System',
        tx,
      });

      return { steps, approvals: [], quoteExtras: {} };
    },
  };
}
