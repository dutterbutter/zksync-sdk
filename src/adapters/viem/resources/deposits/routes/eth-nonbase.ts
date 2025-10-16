// src/adapters/viem/resources/deposits/routes/eth-nonbase.ts

import type { DepositRouteStrategy, ViemPlanWriteRequest } from './types';
import type { PlanStep, ApprovalNeed } from '../../../../../core/types/flows/base';
import { IBridgehubABI, IERC20ABI } from '../../../../../core/internal/abi-registry.ts';
import { encodeSecondBridgeEthArgs } from '../../utils';
import { createErrorHandlers } from '../../../errors/error-ops';
import { OP_DEPOSITS } from '../../../../../core/types';
import { isETH } from '../../../../../core/utils/addr';
import type { Abi } from 'viem';

// error handling
const { wrapAs } = createErrorHandlers('deposits');

// ETH deposit to a chain whose base token is NOT ETH.
export function routeEthNonBase(): DepositRouteStrategy {
  return {
    async preflight(p, ctx) {
      // Assert the asset is ETH.
      await wrapAs(
        'VALIDATION',
        OP_DEPOSITS.ethNonBase.assertEthAsset,
        () => {
          if (!isETH(p.token)) {
            throw new Error('eth-nonbase route requires ETH as the deposit asset.');
          }
        },
        { ctx: { token: p.token } },
      );

      // Resolve base token & assert it's not ETH on target chain.
      const baseToken = (await wrapAs(
        'CONTRACT',
        OP_DEPOSITS.ethNonBase.baseToken,
        () =>
          ctx.client.l1.readContract({
            address: ctx.bridgehub,
            abi: IBridgehubABI as Abi,
            functionName: 'baseToken',
            args: [ctx.chainIdL2],
          }),
        {
          ctx: { where: 'bridgehub.baseToken', chainIdL2: ctx.chainIdL2 },
          message: 'Failed to read base token.',
        },
      )) as `0x${string}`;

      await wrapAs(
        'VALIDATION',
        OP_DEPOSITS.ethNonBase.assertNonEthBase,
        () => {
          if (isETH(baseToken)) {
            throw new Error('eth-nonbase route requires target chain base token ≠ ETH.');
          }
        },
        { ctx: { baseToken, chainIdL2: ctx.chainIdL2 } },
      );

      // Ensure user has enough ETH for the deposit amount (msg.value).
      const ethBal = await wrapAs(
        'RPC',
        OP_DEPOSITS.ethNonBase.ethBalance,
        () => ctx.client.l1.getBalance({ address: ctx.sender }),
        {
          ctx: { where: 'l1.getBalance', sender: ctx.sender },
          message: 'Failed to read L1 ETH balance.',
        },
      );

      await wrapAs(
        'VALIDATION',
        OP_DEPOSITS.ethNonBase.assertEthBalance,
        () => {
          if (ethBal < p.amount) {
            throw new Error('Insufficient L1 ETH balance to cover deposit amount.');
          }
        },
        { ctx: { required: p.amount.toString(), balance: ethBal.toString() } },
      );

      return;
    },

    async build(p, ctx) {
      // Resolve base token
      const baseToken = (await wrapAs(
        'CONTRACT',
        OP_DEPOSITS.ethNonBase.baseToken,
        () =>
          ctx.client.l1.readContract({
            address: ctx.bridgehub,
            abi: IBridgehubABI as Abi,
            functionName: 'baseToken',
            args: [ctx.chainIdL2],
          }),
        {
          ctx: { where: 'bridgehub.baseToken', chainIdL2: ctx.chainIdL2 },
          message: 'Failed to read base token.',
        },
      )) as `0x${string}`;

      // Compute baseCost / mintValue
      const rawBaseCost = (await wrapAs(
        'CONTRACT',
        OP_DEPOSITS.ethNonBase.baseCost,
        () =>
          ctx.client.l1.readContract({
            address: ctx.bridgehub,
            abi: IBridgehubABI as Abi,
            functionName: 'l2TransactionBaseCost',
            args: [ctx.chainIdL2, ctx.fee.gasPriceForBaseCost, ctx.l2GasLimit, ctx.gasPerPubdata],
          }),
        {
          ctx: { where: 'l2TransactionBaseCost', chainIdL2: ctx.chainIdL2 },
          message: 'Could not fetch L2 base cost.',
        },
      )) as bigint;

      const baseCost = BigInt(rawBaseCost);
      const baseCostQuote = ctx.gas.applyBaseCost(
        'base-cost:bridgehub:eth-nonbase',
        'deposit.base-cost.eth-nonbase',
        baseCost,
        { operatorTip: ctx.operatorTip },
      );
      const mintValue = baseCostQuote.recommended;

      const approvals: ApprovalNeed[] = [];
      const steps: PlanStep<ViemPlanWriteRequest>[] = [];

      const allowance = (await wrapAs(
        'CONTRACT',
        OP_DEPOSITS.ethNonBase.allowanceBase,
        () =>
          ctx.client.l1.readContract({
            address: baseToken,
            abi: IERC20ABI as Abi,
            functionName: 'allowance',
            args: [ctx.sender, ctx.l1AssetRouter],
          }),
        {
          ctx: { where: 'erc20.allowance', token: baseToken, spender: ctx.l1AssetRouter },
          message: 'Failed to read base-token allowance.',
        },
      )) as bigint;

      const needsApprove = allowance < mintValue;

      if (needsApprove) {
        const approveParams = {
          address: baseToken,
          abi: IERC20ABI,
          functionName: 'approve',
          args: [ctx.l1AssetRouter, mintValue] as const,
          account: ctx.client.account,
        } as const;

        const approveSim = await wrapAs(
          'CONTRACT',
          OP_DEPOSITS.ethNonBase.estGas,
          () => ctx.client.l1.simulateContract(approveParams),
          {
            ctx: { where: 'l1.simulateContract', to: baseToken },
            message: 'Failed to simulate base-token approve.',
          },
        );

        approvals.push({ token: baseToken, spender: ctx.l1AssetRouter, amount: mintValue });
        const approveTx = approveSim.request as ViemPlanWriteRequest;
        const approveGas = await ctx.gas.ensure(
          `approve:${baseToken}:${ctx.l1AssetRouter}`,
          'deposit.approval.l1',
          approveTx,
          {
            estimator: () =>
              wrapAs(
                'RPC',
                OP_DEPOSITS.ethNonBase.estGas,
                () => ctx.client.l1.estimateContractGas(approveParams),
                {
                  ctx: { where: 'l1.estimateContractGas', to: baseToken },
                  message: 'Failed to estimate gas for base-token approve.',
                },
              ),
          },
        );
        if (approveGas.recommended != null) {
          approveTx.gas = approveGas.recommended;
        }

        steps.push({
          key: `approve:${baseToken}:${ctx.l1AssetRouter}`,
          kind: 'approve',
          description: `Approve base token for mintValue`,
          tx: approveTx,
        });
      }

      const secondBridgeCalldata = await wrapAs(
        'INTERNAL',
        OP_DEPOSITS.ethNonBase.encodeCalldata,
        () => Promise.resolve(encodeSecondBridgeEthArgs(p.amount, p.to ?? ctx.sender)),
        {
          ctx: {
            where: 'encodeSecondBridgeEthArgs',
            amount: p.amount.toString(),
            to: p.to ?? ctx.sender,
          },
          message: 'Failed to encode ETH bridging calldata.',
        },
      );

      const outer = {
        chainId: ctx.chainIdL2,
        mintValue,
        l2Value: 0n,
        l2GasLimit: ctx.l2GasLimit,
        l2GasPerPubdataByteLimit: ctx.gasPerPubdata,
        refundRecipient: ctx.refundRecipient,
        secondBridgeAddress: ctx.l1AssetRouter,
        secondBridgeValue: p.amount,
        secondBridgeCalldata,
      } as const;

      // viem: if approval needed, don't simulate the bridge call (could revert).
      // Return a write-ready request with correct `value = p.amount`.
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

      let bridgeTx: ViemPlanWriteRequest;
      const bridgeParamsBase = {
        address: ctx.bridgehub,
        abi: IBridgehubABI,
        functionName: 'requestL2TransactionTwoBridges',
        args: [outer],
        account: ctx.client.account,
      } as const;

      if (needsApprove) {
        bridgeTx = {
          ...bridgeParamsBase,
          value: p.amount,
          ...feeOverrides,
        } as ViemPlanWriteRequest;
      } else {
        const twoBridgesSim = await wrapAs(
          'CONTRACT',
          OP_DEPOSITS.ethNonBase.estGas,
          () =>
            ctx.client.l1.simulateContract({
              ...bridgeParamsBase,
              value: p.amount,
              ...feeOverrides,
            }),
          {
            ctx: { where: 'l1.simulateContract', to: ctx.bridgehub },
            message: 'Failed to simulate Bridgehub two-bridges request.',
          },
        );
        bridgeTx = twoBridgesSim.request as ViemPlanWriteRequest;
      }

      const bridgeCallParams = { ...bridgeParamsBase, value: p.amount, ...feeOverrides } as const;
      const bridgeGas = await ctx.gas.ensure(
        'bridgehub:two-bridges:eth-nonbase',
        'deposit.bridgehub.two-bridges.eth-nonbase.l1',
        bridgeTx,
        {
          estimator: () =>
            wrapAs(
              'RPC',
              OP_DEPOSITS.ethNonBase.estGas,
              () => ctx.client.l1.estimateContractGas(bridgeCallParams),
              {
                ctx: { where: 'l1.estimateContractGas', to: ctx.bridgehub },
                message: 'Failed to estimate gas for two-bridges request.',
              },
            ),
        },
      );
      if (bridgeGas.recommended != null) {
        bridgeTx.gas = bridgeGas.recommended;
      }

      steps.push({
        key: 'bridgehub:two-bridges:eth-nonbase',
        kind: 'bridgehub:two-bridges',
        description:
          'Bridge ETH (fees in base ERC-20) via Bridgehub.requestL2TransactionTwoBridges',
        tx: bridgeTx,
      });

      return {
        steps,
        approvals,
        quoteExtras: {
          baseCost,
          mintValue,
          baseToken,
          baseIsEth: false,
          gasPlan: ctx.gas.snapshot(),
        },
      };
    },
  };
}
