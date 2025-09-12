/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import type { DepositRouteStrategy } from './types';
import { Contract } from 'ethers';
import type { TransactionRequest } from 'ethers';
import { buildDirectRequestStruct } from '../../utils';
import IBridgehubABI from '../../../../../internal/abis/IBridgehub.json' assert { type: 'json' };
import type { PlanStep } from '../../../../../core/types/flows/base';
import { makeErrorOps } from '../../../errors/to-zksync-error';
import { OP_DEPOSITS } from '../../../../../core/types';

const { withRouteOp } = makeErrorOps('deposits');

export function routeEthDirect(): DepositRouteStrategy {
  return {
    async build(p, ctx) {
      const bh = new Contract(ctx.bridgehub, IBridgehubABI, ctx.client.l1);

      const rawBaseCost = await withRouteOp(
        'RPC',
        OP_DEPOSITS.eth.baseCost,
        'Could not fetch L2 base cost from Bridgehub.',
        { where: 'l2TransactionBaseCost', chainIdL2: ctx.chainIdL2 },
        () =>
          bh.l2TransactionBaseCost(
            ctx.chainIdL2,
            ctx.fee.gasPriceForBaseCost,
            ctx.l2GasLimit,
            ctx.gasPerPubdata,
          ),
      );
      const baseCost = BigInt(rawBaseCost);

      const l2Contract = p.to ?? ctx.sender;
      const l2Value = p.amount;
      const mintValue = baseCost + ctx.operatorTip + l2Value;

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
        from: ctx.sender,
        ...ctx.fee,
      };
      try {
        const est = await withRouteOp(
          'RPC',
          OP_DEPOSITS.eth.estGas,
          'Failed to estimate gas for Bridgehub request.',
          { where: 'l1.estimateGas', to: ctx.bridgehub },
          () => ctx.client.l1.estimateGas(tx),
        );
        tx.gasLimit = (BigInt(est) * 115n) / 100n;
      } catch {
        // ignore
      }

      const steps: PlanStep<TransactionRequest>[] = [
        {
          key: 'bridgehub:direct',
          kind: 'bridgehub:direct',
          description: 'Bridge ETH via Bridgehub.requestL2TransactionDirect',
          tx,
        },
      ];

      return { steps, approvals: [], quoteExtras: { baseCost, mintValue } };
    },
  };
}
