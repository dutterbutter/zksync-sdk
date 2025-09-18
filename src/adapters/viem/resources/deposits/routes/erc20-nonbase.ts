// src/adapters/viem/resources/deposits/routes/erc20-nonbase.ts
import type { DepositRouteStrategy, ViemPlanWriteRequest } from './types';
import type { PlanStep, ApprovalNeed } from '../../../../../core/types/flows/base';
import { encodeSecondBridgeErc20Args } from '../../utils';
import IERC20ABI from '../../../../../internal/abis/IERC20.json' assert { type: 'json' };
import IBridgehubABI from '../../../../../internal/abis/IBridgehub.json' assert { type: 'json' };
import { createErrorHandlers } from '../../../errors/error-ops';
import { OP_DEPOSITS } from '../../../../../core/types';

const { wrapAs } = createErrorHandlers('deposits');

export function routeErc20NonBase(): DepositRouteStrategy {
  return {
    async preflight() {
      // TODO: should move validation stuff here
    },

    async build(p, ctx) {
      const assetRouter = ctx.l1AssetRouter;
      // check allowance
      const allowance = (await wrapAs(
        'CONTRACT',
        OP_DEPOSITS.nonbase.allowance,
        () =>
          ctx.client.l1.readContract({
            address: p.token,
            abi: IERC20ABI,
            functionName: 'allowance',
            args: [ctx.sender, assetRouter],
          }),
        {
          ctx: { where: 'erc20.allowance', token: p.token, spender: assetRouter },
          message: 'Failed to read ERC-20 allowance.',
        },
      )) as bigint;
      const needsApprove = allowance < p.amount;

      // gas floor on L2
      // TODO: this is ugly, lets clean up gas estimation
      // perhaps create a dedicated gas resource?
      const MIN_L2_GAS_FOR_ERC20 = 2_500_000n;
      const l2GasLimitUsed =
        ctx.l2GasLimit && ctx.l2GasLimit > 0n
          ? ctx.l2GasLimit < MIN_L2_GAS_FOR_ERC20
            ? MIN_L2_GAS_FOR_ERC20
            : ctx.l2GasLimit
          : MIN_L2_GAS_FOR_ERC20;

      // base cost
      const rawBaseCost = (await wrapAs(
        'CONTRACT',
        OP_DEPOSITS.nonbase.baseCost,
        () =>
          ctx.client.l1.readContract({
            address: ctx.bridgehub,
            abi: IBridgehubABI,
            functionName: 'l2TransactionBaseCost',
            args: [ctx.chainIdL2, ctx.fee.gasPriceForBaseCost, l2GasLimitUsed, ctx.gasPerPubdata],
          }),
        {
          ctx: { where: 'l2TransactionBaseCost', chainIdL2: ctx.chainIdL2 },
          message: 'Could not fetch L2 base cost from Bridgehub.',
        },
      )) as bigint;

      const baseCost = BigInt(rawBaseCost);
      const mintValue = baseCost + ctx.operatorTip;

      // approvals
      const approvals: ApprovalNeed[] = [];
      const steps: PlanStep<ViemPlanWriteRequest>[] = [];

      if (needsApprove) {
        const approveSim = await wrapAs(
          'CONTRACT',
          OP_DEPOSITS.nonbase.estGas,
          () =>
            ctx.client.l1.simulateContract({
              address: p.token,
              abi: IERC20ABI,
              functionName: 'approve',
              args: [assetRouter, p.amount] as const,
              account: ctx.client.account,
            }),
          {
            ctx: { where: 'l1.simulateContract', to: p.token },
            message: 'Failed to simulate ERC-20 approve.',
          },
        );

        approvals.push({ token: p.token, spender: assetRouter, amount: p.amount });
        steps.push({
          key: `approve:${p.token}:${assetRouter}`,
          kind: 'approve',
          description: `Approve ${p.amount} for router (non-base)`,
          tx: approveSim.request,
        });
      }

      const secondBridgeCalldata = await wrapAs(
        'INTERNAL',
        OP_DEPOSITS.nonbase.encodeCalldata,
        () => Promise.resolve(encodeSecondBridgeErc20Args(p.token, p.amount, p.to ?? ctx.sender)),
        {
          ctx: { where: 'encodeSecondBridgeErc20Args' },
          message: 'Failed to encode bridging calldata.',
        },
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

      // viem only
      //    - if approval needed → DO NOT simulate here (would revert). Return raw write params.
      //    - else → simulate to pick up gas automatically.
      let bridgeTx: ViemPlanWriteRequest;

      if (needsApprove) {
        bridgeTx = {
          address: ctx.bridgehub,
          abi: IBridgehubABI,
          functionName: 'requestL2TransactionTwoBridges',
          args: [outer],
          value: mintValue,
          account: ctx.client.account,
        } as const;
      } else {
        const twoBridgesSim = await wrapAs(
          'CONTRACT',
          OP_DEPOSITS.nonbase.estGas,
          () =>
            ctx.client.l1.simulateContract({
              address: ctx.bridgehub,
              abi: IBridgehubABI,
              functionName: 'requestL2TransactionTwoBridges',
              args: [outer],
              value: mintValue,
              account: ctx.client.account,
            }),
          {
            ctx: { where: 'l1.simulateContract', to: ctx.bridgehub },
            message: 'Failed to simulate Bridgehub two-bridges request.',
          },
        );
        bridgeTx = twoBridgesSim.request;
      }

      steps.push({
        key: 'bridgehub:two-bridges:nonbase',
        kind: 'bridgehub:two-bridges',
        description: 'Bridge ERC20 (non-base) via Bridgehub.requestL2TransactionTwoBridges',
        tx: bridgeTx,
      });

      return { steps, approvals, quoteExtras: { baseCost, mintValue } };
    },
  };
}
