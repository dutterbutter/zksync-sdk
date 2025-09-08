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

export function routeErc20NonBase(): DepositRouteStrategy {
  return {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async preflight(p, ctx) {
      // Example: validate token is not the base token for this L2
      // const baseToken = await resolveBaseToken(ctx.client, ctx.bridgehub, ctx.chainIdL2);
      // if (eqAddr(baseToken, p.token)) throw new Error('non-base route requires a non-base token');
    },
    async build(p, ctx) {
      const bh = new Contract(ctx.bridgehub, IBridgehubABI, ctx.client.l1);
      const assetRouter = ctx.l1AssetRouter;
      const erc20 = new Contract(p.token, IERC20ABI, ctx.client.signer);
      const allowance: bigint = await erc20.allowance(ctx.sender, assetRouter);
      const needsApprove = allowance < p.amount;

      // TODO: clean up gas estimation
      const MIN_L2_GAS_FOR_ERC20 = 2_500_000n; // matches the passing test
      const l2GasLimitUsed =
        ctx.l2GasLimit && ctx.l2GasLimit > 0n
          ? ctx.l2GasLimit < MIN_L2_GAS_FOR_ERC20
            ? MIN_L2_GAS_FOR_ERC20
            : ctx.l2GasLimit
          : MIN_L2_GAS_FOR_ERC20;

      const baseCost = BigInt(
        await bh.l2TransactionBaseCost(
          ctx.chainIdL2,
          ctx.fee.gasPriceForBaseCost,
          l2GasLimitUsed,
          ctx.gasPerPubdata,
        ),
      );
      const mintValue = baseCost + ctx.operatorTip;

      const approvals: ApprovalNeed[] = [];
      const steps: PlanStep<TransactionRequest>[] = [];

      if (needsApprove) {
        approvals.push({ token: p.token, spender: assetRouter, amount: p.amount });
        const data = erc20.interface.encodeFunctionData('approve', [assetRouter, p.amount]);
        steps.push({
          key: `approve:${p.token}:${assetRouter}`,
          kind: 'approve',
          description: `Approve ${p.amount} for router (non-base)`,
          canSkip: false,
          tx: { to: p.token, data, from: ctx.sender, ...ctx.fee },
        });
      }

      // TODO: update calldata encoding if non-base requires different tuple/selector
      const secondBridgeCalldata = encodeSecondBridgeErc20Args(
        p.token,
        p.amount,
        p.to ?? ctx.sender,
      );

      const outer = {
        chainId: ctx.chainIdL2,
        mintValue,
        l2Value: 0n,
        l2GasLimit: l2GasLimitUsed,
        l2GasPerPubdataByteLimit: ctx.gasPerPubdata,
        refundRecipient: ctx.refundRecipient,
        secondBridgeAddress: assetRouter,
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
        bridgeTx.gasLimit = (BigInt(est) * 125n) / 100n;
      } catch {
        // ignore
      }

      steps.push({
        key: 'bridgehub:two-bridges:nonbase',
        kind: 'bridgehub:two-bridges',
        description: 'Bridge ERC20 (non-base) via Bridgehub.requestL2TransactionTwoBridges',
        canSkip: false,
        tx: bridgeTx,
      });

      return { steps, approvals, quoteExtras: { baseCost, mintValue } };
    },
  };
}
