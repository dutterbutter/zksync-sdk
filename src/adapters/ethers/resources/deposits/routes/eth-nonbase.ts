// src/adapters/ethers/resources/deposits/routes/eth-nonbase.ts

import type { DepositRouteStrategy } from './types';
import { Contract } from 'ethers';
import type { TransactionRequest } from 'ethers';
import { IBridgehubABI, IERC20ABI } from '../../../../../core/internal/abi-registry.ts';
import { encodeSecondBridgeEthArgs } from '../../utils';
import type { ApprovalNeed, PlanStep } from '../../../../../core/types/flows/base';
import { createErrorHandlers } from '../../../errors/error-ops';
import { OP_DEPOSITS } from '../../../../../core/types';
import { isETH } from '../../../../../core/utils/addr';
import type { Address } from '../../../../../core/types/primitives.ts';

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
      const bh = new Contract(ctx.bridgehub, IBridgehubABI, ctx.client.l1);
      const baseToken = (await wrapAs(
        'CONTRACT',
        OP_DEPOSITS.ethNonBase.baseToken,
        () => bh.baseToken(ctx.chainIdL2),
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

      // Cheap preflight: ensure user has enough ETH for the deposit amount (msg.value).
      if (ctx.sender) {
        const ethBal = await wrapAs(
          'RPC',
          OP_DEPOSITS.ethNonBase.ethBalance,
          () => ctx.client.l1.getBalance(ctx.sender!),
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
      }

      return;
    },

    async build(p, ctx) {
      const bh = new Contract(ctx.bridgehub, IBridgehubABI, ctx.client.l1);
      const sender = ctx.sender;

      const baseToken = (await wrapAs(
        'CONTRACT',
        OP_DEPOSITS.ethNonBase.baseToken,
        () => bh.baseToken(ctx.chainIdL2),
        {
          ctx: { where: 'bridgehub.baseToken', chainIdL2: ctx.chainIdL2 },
          message: 'Failed to read base token.',
        },
      )) as `0x${string}`;

      // Compute baseCost / mintValue (fees funded in base token)
      const rawBaseCost = (await wrapAs(
        'RPC',
        OP_DEPOSITS.ethNonBase.baseCost,
        () =>
          bh.l2TransactionBaseCost(
            ctx.chainIdL2,
            ctx.fee.gasPriceForBaseCost,
            ctx.l2GasLimit,
            ctx.gasPerPubdata,
          ),
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
      const steps: PlanStep<TransactionRequest>[] = [];

      // Ensure base-token allowance to L1AssetRouter for `mintValue`
      {
        const erc20 = new Contract(baseToken, IERC20ABI, ctx.client.l1);
        let allowance: bigint | undefined;
        if (sender) {
          allowance = (await wrapAs(
            'RPC',
            OP_DEPOSITS.ethNonBase.allowanceBase,
            () => erc20.allowance(sender, ctx.l1AssetRouter),
            {
              ctx: { where: 'erc20.allowance', token: baseToken, spender: ctx.l1AssetRouter },
              message: 'Failed to read base-token allowance.',
            },
          )) as bigint;
        }

        if (allowance == null || allowance < mintValue) {
          approvals.push({ token: baseToken, spender: ctx.l1AssetRouter, amount: mintValue });
          const data = erc20.interface.encodeFunctionData('approve', [
            ctx.l1AssetRouter,
            mintValue,
          ]);
          const approveTx: TransactionRequest = {
            to: baseToken,
            data,
            ...ctx.fee,
          };
          if (sender) {
            approveTx.from = sender;
          }
          const approveGas = await ctx.gas.ensure(
            `approve:${baseToken}:${ctx.l1AssetRouter}`,
            'deposit.approval.l1',
            approveTx,
            {
              estimator: (request) =>
                wrapAs(
                  'RPC',
                  OP_DEPOSITS.ethNonBase.estGas,
                  () => ctx.client.l1.estimateGas(request),
                  {
                    ctx: { where: 'l1.estimateGas', to: baseToken },
                    message: 'Failed to estimate gas for ERC-20 approval (base token).',
                  },
                ),
            },
          );
          if (approveGas.recommended != null) {
            approveTx.gasLimit = approveGas.recommended;
          }
          steps.push({
            key: `approve:${baseToken}:${ctx.l1AssetRouter}`,
            kind: 'approve',
            description: `Approve base token for mintValue`,
            tx: approveTx,
          });
        }
      }

      // Build Two-Bridges call
      const l2Receiver = (p.to ?? sender) as Address | undefined;
      if (!l2Receiver) {
        throw new Error(
          'Deposits require a target L2 address. Provide params.to when no sender account is available.',
        );
      }
      const secondBridgeCalldata = await wrapAs(
        'INTERNAL',
        OP_DEPOSITS.ethNonBase.encodeCalldata,
        () => Promise.resolve(encodeSecondBridgeEthArgs(p.amount, l2Receiver)),
        {
          ctx: {
            where: 'encodeSecondBridgeEthArgs',
            amount: p.amount.toString(),
            to: l2Receiver,
          },
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

      const dataTwo = new Contract(
        ctx.bridgehub,
        IBridgehubABI,
        ctx.client.l1,
      ).interface.encodeFunctionData('requestL2TransactionTwoBridges', [outer]);

      const bridgeTx: TransactionRequest = {
        to: ctx.bridgehub,
        data: dataTwo,
        value: p.amount, // base ≠ ETH ⇒ msg.value == secondBridgeValue
        ...ctx.fee,
      };
      if (sender) {
        bridgeTx.from = sender;
      }

      const gas = await ctx.gas.ensure(
        'bridgehub:two-bridges:eth-nonbase',
        'deposit.bridgehub.two-bridges.eth-nonbase.l1',
        bridgeTx,
        {
          estimator: (request) =>
            wrapAs('RPC', OP_DEPOSITS.ethNonBase.estGas, () => ctx.client.l1.estimateGas(request), {
              ctx: { where: 'l1.estimateGas', to: ctx.bridgehub },
              message: 'Failed to estimate gas for Bridgehub request.',
            }),
        },
      );
      if (gas.recommended != null) {
        bridgeTx.gasLimit = gas.recommended;
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
        quoteExtras: { baseCost, mintValue, gasPlan: ctx.gas.snapshot() },
      };
    },
  };
}
