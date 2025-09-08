/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { DepositRouteStrategy } from './types';
import { Contract } from 'ethers';
import type { TransactionRequest } from 'ethers';
import { encodeSecondBridgeErc20Args } from '../../utils';
import IERC20ABI from '../../../../../internal/abis/IERC20.json' assert { type: 'json' };
import IBridgehubABI from '../../../../../internal/abis/IBridgehub.json' assert { type: 'json' };
import type { ApprovalNeed, PlanStep } from '../../../../../core/types/flows/base';

export function routeErc20Base(): DepositRouteStrategy {
  return {
    async build(p, ctx) {
      const bh = new Contract(ctx.bridgehub, IBridgehubABI, ctx.client.l1);
      const router = ctx.l1AssetRouter;

      const erc20 = new Contract(p.token, IERC20ABI, ctx.client.signer);
      const allowance: bigint = await erc20.allowance(ctx.sender, router);
      const needsApprove = allowance < p.amount;

      const baseCost = BigInt(
        await bh.l2TransactionBaseCost(
          ctx.chainIdL2,
          ctx.fee.gasPriceForBaseCost,
          ctx.l2GasLimit,
          ctx.gasPerPubdata,
        ),
      );
      const mintValue = baseCost + ctx.operatorTip;

      const approvals: ApprovalNeed[] = [];
      const steps: PlanStep<TransactionRequest>[] = [];

      if (needsApprove) {
        approvals.push({ token: p.token, spender: router, amount: p.amount });
        const data = erc20.interface.encodeFunctionData('approve', [router, p.amount]);
        steps.push({
          key: `approve:${p.token}:${router}`,
          kind: 'approve',
          description: `Approve ${p.amount} for router`,
          canSkip: false,
          tx: { to: p.token, data, from: ctx.sender, ...ctx.fee },
        });
      }

      const secondBridgeCalldata = encodeSecondBridgeErc20Args(
        p.token,
        p.amount,
        p.to ?? ctx.sender,
      );
      const outer = {
        chainId: ctx.chainIdL2,
        mintValue,
        l2Value: 0n,
        l2GasLimit: ctx.l2GasLimit,
        l2GasPerPubdataByteLimit: ctx.gasPerPubdata,
        refundRecipient: ctx.refundRecipient,
        secondBridgeAddress: router,
        secondBridgeValue: 0n,
        secondBridgeCalldata,
      } as const;

      const dataTwo = bh.interface.encodeFunctionData('requestL2TransactionTwoBridges', [outer]);
      const bridgeTx: TransactionRequest = {
        to: ctx.bridgehub,
        data: dataTwo,
        value: mintValue,
        from: ctx.sender,
        ...ctx.fee,
      };
      try {
        const est = await ctx.client.l1.estimateGas(bridgeTx);
        bridgeTx.gasLimit = (BigInt(est) * 115n) / 100n;
      } catch {
        // ignore
      }

      steps.push({
        key: 'bridgehub:two-bridges',
        kind: 'bridgehub:two-bridges',
        description: 'Bridge ERC20 via Bridgehub.requestL2TransactionTwoBridges',
        canSkip: false,
        tx: bridgeTx,
      });

      return { steps, approvals, quoteExtras: { baseCost, mintValue } };
    },
  };
}
