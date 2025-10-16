// src/adapters/viem/resources/deposits/routes/erc20-base.ts

import type { DepositRouteStrategy, ViemPlanWriteRequest } from './types';
import type { PlanStep, ApprovalNeed } from '../../../../../core/types/flows/base';
import { IBridgehubABI, IERC20ABI } from '../../../../../core/internal/abi-registry.ts';
import { buildDirectRequestStruct } from '../../utils';
import { createErrorHandlers } from '../../../errors/error-ops';
import { OP_DEPOSITS } from '../../../../../core/types';
import { normalizeAddrEq, isETH } from '../../../../../core/utils/addr';
import type { Abi } from 'viem';

const { wrapAs } = createErrorHandlers('deposits');

//  ERC20 deposit where the deposit token IS the target chain's base token (base ≠ ETH).
export function routeErc20Base(): DepositRouteStrategy {
  return {
    async preflight(p, ctx) {
      // Must be ERC-20 (not ETH)
      await wrapAs(
        'VALIDATION',
        OP_DEPOSITS.base.assertErc20Asset,
        () => {
          if (isETH(p.token)) {
            throw new Error('erc20-base route requires an ERC-20 token (not ETH).');
          }
        },
        { ctx: { token: p.token } },
      );

      // Check provided token matches target chain base token
      const baseToken = (await wrapAs(
        'CONTRACT',
        OP_DEPOSITS.base.baseToken,
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
        OP_DEPOSITS.base.assertMatchesBase,
        () => {
          if (!normalizeAddrEq(baseToken, p.token)) {
            throw new Error('Provided token is not the base token for the target chain.');
          }
        },
        { ctx: { baseToken, provided: p.token, chainIdL2: ctx.chainIdL2 } },
      );

      return;
    },

    async build(p, ctx) {
      const baseToken = (await wrapAs(
        'CONTRACT',
        OP_DEPOSITS.base.baseToken,
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

      // Base cost on L2
      const rawBaseCost = (await wrapAs(
        'CONTRACT',
        OP_DEPOSITS.base.baseCost,
        () =>
          ctx.client.l1.readContract({
            address: ctx.bridgehub,
            abi: IBridgehubABI as Abi,
            functionName: 'l2TransactionBaseCost',
            args: [ctx.chainIdL2, ctx.fee.gasPriceForBaseCost, ctx.l2GasLimit, ctx.gasPerPubdata],
          }),
        {
          ctx: { where: 'l2TransactionBaseCost', chainIdL2: ctx.chainIdL2 },
          message: 'Could not fetch L2 base cost from Bridgehub.',
        },
      )) as bigint;

      const baseCost = rawBaseCost;
      const l2Value = p.amount;
      const baseCostQuote = ctx.gas.applyBaseCost(
        'base-cost:bridgehub:erc20-base',
        'deposit.base-cost.erc20-base',
        baseCost,
        { operatorTip: ctx.operatorTip, extras: l2Value },
      );
      const mintValue = baseCostQuote.recommended;

      // Check allowance for base token -> L1AssetRouter
      const allowance = (await wrapAs(
        'CONTRACT',
        OP_DEPOSITS.base.allowance,
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

      const approvals: ApprovalNeed[] = [];
      const steps: PlanStep<ViemPlanWriteRequest>[] = [];

      const needsApprove = allowance < mintValue;
      if (needsApprove) {
        const approveParams = {
          address: baseToken,
          abi: IERC20ABI as Abi,
          functionName: 'approve',
          args: [ctx.l1AssetRouter, mintValue] as const,
          account: ctx.client.account,
        } as const;

        const approveSim = await wrapAs(
          'CONTRACT',
          OP_DEPOSITS.base.estGas,
          () => ctx.client.l1.simulateContract(approveParams),
          {
            ctx: { where: 'l1.simulateContract', to: baseToken },
            message: 'Failed to simulate ERC-20 approve.',
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
                OP_DEPOSITS.base.estGas,
                () => ctx.client.l1.estimateContractGas(approveParams),
                {
                  ctx: { where: 'l1.estimateContractGas', to: baseToken },
                  message: 'Failed to estimate gas for ERC-20 approve.',
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
          description: 'Approve base token for mintValue',
          tx: approveTx,
        });
      }

      const req = buildDirectRequestStruct({
        chainId: ctx.chainIdL2,
        mintValue,
        l2GasLimit: ctx.l2GasLimit,
        gasPerPubdata: ctx.gasPerPubdata,
        refundRecipient: ctx.refundRecipient,
        l2Contract: p.to ?? ctx.sender,
        l2Value,
      });

      // viem: if approval needed, don't simulate (would revert due to insufficient allowance).
      // Just return a write-ready request. Otherwise, simulate to capture gas settings.
      let bridgeTx: ViemPlanWriteRequest;
      const bridgeParamsBase = {
        address: ctx.bridgehub,
        abi: IBridgehubABI as Abi,
        functionName: 'requestL2TransactionDirect',
        args: [req],
        account: ctx.client.account,
      } as const;

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

      if (needsApprove) {
        bridgeTx = {
          ...bridgeParamsBase,
          value: 0n, // base is ERC-20 ⇒ msg.value MUST be 0
          ...feeOverrides,
        } as ViemPlanWriteRequest;
      } else {
        const sim = await wrapAs(
          'RPC',
          OP_DEPOSITS.base.estGas,
          () => ctx.client.l1.simulateContract({ ...bridgeParamsBase, value: 0n, ...feeOverrides }),
          {
            ctx: { where: 'l1.simulateContract', to: ctx.bridgehub },
            message: 'Failed to simulate Bridgehub.requestL2TransactionDirect.',
          },
        );
        bridgeTx = sim.request as ViemPlanWriteRequest;
      }

      const bridgeCallParams = { ...bridgeParamsBase, value: 0n, ...feeOverrides } as const;
      const gas = await ctx.gas.ensure(
        'bridgehub:direct:erc20-base',
        'deposit.bridgehub.direct.l1',
        bridgeTx,
        {
          estimator: () =>
            wrapAs(
              'RPC',
              OP_DEPOSITS.base.estGas,
              () => ctx.client.l1.estimateContractGas(bridgeCallParams),
              {
                ctx: { where: 'l1.estimateContractGas', to: ctx.bridgehub },
                message: 'Failed to estimate gas for Bridgehub request.',
              },
            ),
        },
      );
      if (gas.recommended != null) {
        bridgeTx.gas = gas.recommended;
      }

      steps.push({
        key: 'bridgehub:direct:erc20-base',
        kind: 'bridgehub:direct',
        description: 'Bridge base ERC-20 via Bridgehub.requestL2TransactionDirect',
        tx: bridgeTx,
      });

      return {
        steps,
        approvals,
        quoteExtras: { baseCost, mintValue, gasPlan: ctx.gas.snapshot() },
      };
    },
  };
}
