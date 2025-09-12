// src/adapters/ethers/resources/withdrawals/routes/eth.ts
import { Contract, Interface, type TransactionRequest } from 'ethers';
import type { WithdrawRouteStrategy } from './types';
import type { PlanStep } from '../../../../../core/types/flows/base';
import { L2_BASE_TOKEN_SYSTEM_CONTRACT_ADDR } from '../../../../../core/constants';
import L2BaseTokenABI from '../../../../../internal/abis/IBaseToken.json' assert { type: 'json' };

import { makeErrorOps } from '../../../errors/to-zksync-error';
import { OP_WITHDRAWALS } from '../../../../../core/types';

const { withRouteOp } = makeErrorOps('withdrawals');

export function routeEth(): WithdrawRouteStrategy {
  return {
    async build(p, ctx) {
      const steps: Array<PlanStep<TransactionRequest>> = [];

      const base = new Contract(
        L2_BASE_TOKEN_SYSTEM_CONTRACT_ADDR,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        new Interface(L2BaseTokenABI),
        ctx.client.l2,
      );

      const toL1 = p.to ?? ctx.sender;
      const data = await withRouteOp(
        'INTERNAL',
        OP_WITHDRAWALS.eth.encodeWithdraw,
        'Failed to encode ETH withdraw calldata.',
        { where: 'L2BaseToken.withdraw', to: toL1 },
        () => Promise.resolve(base.interface.encodeFunctionData('withdraw', [toL1])),
      );

      const tx: TransactionRequest = {
        to: L2_BASE_TOKEN_SYSTEM_CONTRACT_ADDR,
        data,
        from: ctx.sender,
        value: p.amount,
      };

      // TODO: improve gas estimations
      try {
        const est = await withRouteOp(
          'RPC',
          OP_WITHDRAWALS.eth.estGas,
          'Failed to estimate gas for L2 ETH withdraw.',
          { where: 'l2.estimateGas', to: L2_BASE_TOKEN_SYSTEM_CONTRACT_ADDR },
          () => ctx.client.l2.estimateGas(tx),
        );
        tx.gasLimit = (BigInt(est) * 115n) / 100n;
      } catch {
        // ignore
      }

      steps.push({
        key: 'l2-base-token:withdraw',
        kind: 'l2-base-token:withdraw',
        description: 'Withdraw ETH via L2 Base Token System',
        tx,
      });

      return { steps, approvals: [], quoteExtras: {} };
    },
  };
}
