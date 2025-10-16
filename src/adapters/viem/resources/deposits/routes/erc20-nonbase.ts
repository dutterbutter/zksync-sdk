// src/adapters/viem/resources/deposits/routes/erc20-nonbase.ts
import type { DepositRouteStrategy, ViemPlanWriteRequest } from './types';
import type { PlanStep, ApprovalNeed } from '../../../../../core/types/flows/base';
import { encodeSecondBridgeErc20Args } from '../../utils';
import { IERC20ABI, IBridgehubABI } from '../../../../../core/internal/abi-registry.ts';
import { createErrorHandlers } from '../../../errors/error-ops';
import { OP_DEPOSITS } from '../../../../../core/types';
import { isETH, normalizeAddrEq } from '../../../../../core/utils/addr';
import type { Abi } from 'viem';

const { wrapAs } = createErrorHandlers('deposits');

export function routeErc20NonBase(): DepositRouteStrategy {
  return {
    async preflight(p, ctx) {
      // Validations: deposit token must be ERC-20 and not the base token
      await wrapAs(
        'VALIDATION',
        OP_DEPOSITS.nonbase.assertNotEthAsset,
        () => {
          if (isETH(p.token)) {
            throw new Error('erc20-nonbase route requires an ERC-20 token (not ETH).');
          }
        },
        { ctx: { token: p.token } },
      );

      const baseToken = (await wrapAs(
        'CONTRACT',
        OP_DEPOSITS.nonbase.baseToken,
        () =>
          ctx.client.l1.readContract({
            address: ctx.bridgehub,
            abi: IBridgehubABI as Abi,
            functionName: 'baseToken',
            args: [ctx.chainIdL2],
          }),
        { ctx: { where: 'bridgehub.baseToken', chainIdL2: ctx.chainIdL2 } },
      )) as `0x${string}`;

      await wrapAs(
        'VALIDATION',
        OP_DEPOSITS.nonbase.assertNonBaseToken,
        () => {
          if (normalizeAddrEq(baseToken, p.token)) {
            throw new Error('erc20-nonbase route requires a non-base ERC-20 deposit token.');
          }
        },
        { ctx: { depositToken: p.token, baseToken } },
      );

      return;
    },

    async build(p, ctx) {
      if (!ctx.sender) {
        throw new Error(
          'Deposits require a sender account. Provide params.sender or configure the client with an account.',
        );
      }
      const sender = ctx.sender!;
      // Read base token
      const baseToken = (await wrapAs(
        'CONTRACT',
        OP_DEPOSITS.nonbase.baseToken,
        () =>
          ctx.client.l1.readContract({
            address: ctx.bridgehub,
            abi: IBridgehubABI as Abi,
            functionName: 'baseToken',
            args: [ctx.chainIdL2],
          }),
        { ctx: { where: 'bridgehub.baseToken', chainIdL2: ctx.chainIdL2 } },
      )) as `0x${string}`;

      // TODO: again need to consolidate all gas estimations, buffers, etc.
      const MIN_L2_GAS_FOR_ERC20 = 2_500_000n;
      const l2GasLimitUsed =
        ctx.l2GasLimit && ctx.l2GasLimit > 0n
          ? ctx.l2GasLimit < MIN_L2_GAS_FOR_ERC20
            ? MIN_L2_GAS_FOR_ERC20
            : ctx.l2GasLimit
          : MIN_L2_GAS_FOR_ERC20;

      // Base cost (L2 fee) → mintValue = baseCost + tip (buffered)
      const rawBaseCost = (await wrapAs(
        'CONTRACT',
        OP_DEPOSITS.nonbase.baseCost,
        () =>
          ctx.client.l1.readContract({
            address: ctx.bridgehub,
            abi: IBridgehubABI as Abi,
            functionName: 'l2TransactionBaseCost',
            args: [ctx.chainIdL2, ctx.fee.gasPriceForBaseCost, l2GasLimitUsed, ctx.gasPerPubdata],
          }),
        { ctx: { where: 'l2TransactionBaseCost', chainIdL2: ctx.chainIdL2 } },
      )) as bigint;

      const baseCost = rawBaseCost;
      const baseCostQuote = ctx.gas.applyBaseCost(
        'base-cost:bridgehub:erc20-nonbase',
        'deposit.base-cost.erc20-nonbase',
        baseCost,
        { operatorTip: ctx.operatorTip },
      );
      const mintValue = baseCostQuote.recommended;

      // Approvals
      const approvals: ApprovalNeed[] = [];
      const steps: PlanStep<ViemPlanWriteRequest>[] = [];

      const depositAllowance = (await wrapAs(
        'CONTRACT',
        OP_DEPOSITS.nonbase.allowance,
        () =>
          ctx.client.l1.readContract({
            address: p.token,
            abi: IERC20ABI as Abi,
            functionName: 'allowance',
            args: [sender, ctx.l1AssetRouter],
          }),
        {
          ctx: { where: 'erc20.allowance', token: p.token, spender: ctx.l1AssetRouter },
          message: 'Failed to read ERC-20 allowance for deposit token.',
        },
      )) as bigint;

      const needsDepositApprove = depositAllowance < p.amount;
      if (needsDepositApprove) {
        const approveDepParams = {
          address: p.token,
          abi: IERC20ABI,
          functionName: 'approve',
          args: [ctx.l1AssetRouter, p.amount] as const,
          account: ctx.client.account,
        } as const;

        const approveDepReq = await wrapAs(
          'CONTRACT',
          OP_DEPOSITS.nonbase.estGas,
          () => ctx.client.l1.simulateContract(approveDepParams),
          {
            ctx: { where: 'l1.simulateContract', to: p.token },
            message: 'Failed to simulate deposit token approve.',
          },
        );

        approvals.push({ token: p.token, spender: ctx.l1AssetRouter, amount: p.amount });
        const approveTx = approveDepReq.request as ViemPlanWriteRequest;
        const approveGas = await ctx.gas.ensure(
          `approve:${p.token}:${ctx.l1AssetRouter}`,
          'deposit.approval.l1',
          approveTx,
          {
            estimator: () =>
              wrapAs(
                'RPC',
                OP_DEPOSITS.nonbase.estGas,
                () => ctx.client.l1.estimateContractGas(approveDepParams),
                {
                  ctx: { where: 'l1.estimateContractGas', to: p.token },
                  message: 'Failed to estimate gas for deposit token approve.',
                },
              ),
          },
        );
        if (approveGas.recommended != null) {
          approveTx.gas = approveGas.recommended;
        }

        steps.push({
          key: `approve:${p.token}:${ctx.l1AssetRouter}`,
          kind: 'approve',
          description: `Approve deposit token for amount`,
          tx: approveTx,
        });
      }

      const baseIsEth = isETH(baseToken);
      let msgValue: bigint = 0n;

      if (!baseIsEth) {
        const baseAllowance = (await wrapAs(
          'CONTRACT',
          OP_DEPOSITS.nonbase.allowanceFees,
          () =>
            ctx.client.l1.readContract({
            address: baseToken,
            abi: IERC20ABI as Abi,
            functionName: 'allowance',
            args: [sender, ctx.l1AssetRouter],
          }),
          {
            ctx: { where: 'erc20.allowance', token: baseToken, spender: ctx.l1AssetRouter },
            message: 'Failed to read base-token allowance.',
          },
        )) as bigint;

        if (baseAllowance < mintValue) {
          const approveBaseParams = {
            address: baseToken,
            abi: IERC20ABI,
            functionName: 'approve',
            args: [ctx.l1AssetRouter, mintValue] as const,
            account: ctx.client.account,
          } as const;

          const approveBaseReq = await wrapAs(
            'CONTRACT',
            OP_DEPOSITS.nonbase.estGas,
            () => ctx.client.l1.simulateContract(approveBaseParams),
            {
              ctx: { where: 'l1.simulateContract', to: baseToken },
              message: 'Failed to simulate base-token approve.',
            },
          );

          approvals.push({ token: baseToken, spender: ctx.l1AssetRouter, amount: mintValue });
          const approveBaseTx = approveBaseReq.request as ViemPlanWriteRequest;
          const approveBaseGas = await ctx.gas.ensure(
            `approve:${baseToken}:${ctx.l1AssetRouter}`,
            'deposit.approval.l1',
            approveBaseTx,
            {
              estimator: () =>
                wrapAs(
                  'RPC',
                  OP_DEPOSITS.nonbase.estGas,
                  () => ctx.client.l1.estimateContractGas(approveBaseParams),
                  {
                    ctx: { where: 'l1.estimateContractGas', to: baseToken },
                    message: 'Failed to estimate gas for base-token approve.',
                  },
                ),
            },
          );
          if (approveBaseGas.recommended != null) {
            approveBaseTx.gas = approveBaseGas.recommended;
          }

          steps.push({
            key: `approve:${baseToken}:${ctx.l1AssetRouter}`,
            kind: 'approve',
            description: `Approve base token for mintValue`,
            tx: approveBaseTx,
          });
        }

        // Base is ERC-20 ⇒ msg.value MUST be 0
        msgValue = 0n;
      } else {
        // Base is ETH ⇒ fees in ETH (msg.value = mintValue)
        msgValue = mintValue;
      }

      const secondBridgeCalldata = await wrapAs(
        'INTERNAL',
        OP_DEPOSITS.nonbase.encodeCalldata,
        () => Promise.resolve(encodeSecondBridgeErc20Args(p.token, p.amount, p.to ?? sender)),
        {
          ctx: {
            where: 'encodeSecondBridgeErc20Args',
            token: p.token,
            amount: p.amount.toString(),
          },
        },
      );

      const outer = {
        chainId: ctx.chainIdL2,
        mintValue,
        l2Value: 0n,
        l2GasLimit: l2GasLimitUsed,
        l2GasPerPubdataByteLimit: ctx.gasPerPubdata,
        refundRecipient: ctx.refundRecipient,
        secondBridgeAddress: ctx.l1AssetRouter,
        secondBridgeValue: 0n,
        secondBridgeCalldata,
      } as const;

      // viem simulate/write:
      // If any approval is required, skip simulate (can revert) and return a raw write.
      const approvalsNeeded = approvals.length > 0;
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

      if (approvalsNeeded) {
        bridgeTx = {
          ...bridgeParamsBase,
          value: msgValue,
          ...feeOverrides,
        } as ViemPlanWriteRequest;
      } else {
        const sim = await wrapAs(
          'CONTRACT',
          OP_DEPOSITS.nonbase.estGas,
          () =>
            ctx.client.l1.simulateContract({
              ...bridgeParamsBase,
              value: msgValue,
              ...feeOverrides,
            }),
          {
            ctx: { where: 'l1.simulateContract', to: ctx.bridgehub },
            message: 'Failed to simulate two-bridges request.',
          },
        );
        bridgeTx = sim.request as ViemPlanWriteRequest;
      }

      const bridgeCallParams = { ...bridgeParamsBase, value: msgValue, ...feeOverrides } as const;
      const bridgeGas = await ctx.gas.ensure(
        'bridgehub:two-bridges:nonbase',
        'deposit.bridgehub.two-bridges.erc20.l1',
        bridgeTx,
        {
          estimator: () =>
            wrapAs(
              'RPC',
              OP_DEPOSITS.nonbase.estGas,
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
        key: 'bridgehub:two-bridges:nonbase',
        kind: 'bridgehub:two-bridges',
        description: baseIsEth
          ? 'Bridge ERC-20 (fees in ETH) via Bridgehub.requestL2TransactionTwoBridges'
          : 'Bridge ERC-20 (fees in base ERC-20) via Bridgehub.requestL2TransactionTwoBridges',
        tx: bridgeTx,
      });

      return {
        steps,
        approvals,
        quoteExtras: {
          baseCost,
          mintValue,
          baseToken,
          baseIsEth,
          gasPlan: ctx.gas.snapshot(),
        },
      };
    },
  };
}
