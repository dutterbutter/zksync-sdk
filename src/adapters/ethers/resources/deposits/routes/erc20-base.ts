import type { DepositRouteStrategy } from './types';
import { Contract } from 'ethers';
import type { TransactionRequest } from 'ethers';
import { IBridgehubABI, IERC20ABI } from '../../../../../core/internal/abi-registry.ts';
import { buildDirectRequestStruct } from '../../utils';
import type { ApprovalNeed, PlanStep } from '../../../../../core/types/flows/base';
import { createErrorHandlers } from '../../../errors/error-ops';
import { OP_DEPOSITS } from '../../../../../core/types';
import { normalizeAddrEq, isETH } from '../../../../../core/utils/addr';
import type { Address } from '../../../../../core/types/primitives.ts';

// error handling
const { wrapAs } = createErrorHandlers('deposits');

//  ERC20 deposit where the deposit token IS the target chain's base token (base ≠ ETH).
export function routeErc20Base(): DepositRouteStrategy {
  return {
    async preflight(p, ctx) {
      // Basic validation: depositing ETH here would be wrong.
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
      const bh = new Contract(ctx.bridgehub, IBridgehubABI, ctx.client.l1);
      const baseToken = (await wrapAs(
        'CONTRACT',
        OP_DEPOSITS.base.baseToken,
        () => bh.baseToken(ctx.chainIdL2),
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
      const bh = new Contract(ctx.bridgehub, IBridgehubABI, ctx.client.l1);
      const sender = ctx.sender;

      // Read base token
      const baseToken = (await wrapAs(
        'CONTRACT',
        OP_DEPOSITS.base.baseToken,
        () => bh.baseToken(ctx.chainIdL2),
        {
          ctx: { where: 'bridgehub.baseToken', chainIdL2: ctx.chainIdL2 },
          message: 'Failed to read base token.',
        },
      )) as `0x${string}`;

      // Base cost
      const rawBaseCost = (await wrapAs(
        'RPC',
        OP_DEPOSITS.base.baseCost,
        () =>
          bh.l2TransactionBaseCost(
            ctx.chainIdL2,
            ctx.fee.gasPriceForBaseCost,
            ctx.l2GasLimit,
            ctx.gasPerPubdata,
          ),
        {
          ctx: { where: 'l2TransactionBaseCost', chainIdL2: ctx.chainIdL2 },
          message: 'Could not fetch L2 base cost from Bridgehub.',
        },
      )) as bigint;
      const baseCost = BigInt(rawBaseCost);

      // Direct path: mintValue must cover fee + the L2 msg.value (amount)
      const l2Value = p.amount;
      const baseCostQuote = ctx.gas.applyBaseCost(
        'base-cost:bridgehub:erc20-base',
        'deposit.base-cost.erc20-base',
        baseCost,
        { operatorTip: ctx.operatorTip, extras: l2Value },
      );

      const mintValue = baseCostQuote.recommended;

      const approvals: ApprovalNeed[] = [];
      const steps: PlanStep<TransactionRequest>[] = [];

      // Check allowance for base token -> L1AssetRouter
      {
        const erc20 = new Contract(baseToken, IERC20ABI, ctx.client.l1);
        let allowance: bigint | undefined;
        if (sender) {
          allowance = (await wrapAs(
            'RPC',
            OP_DEPOSITS.base.allowance,
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
                wrapAs('RPC', OP_DEPOSITS.base.estGas, () => ctx.client.l1.estimateGas(request), {
                  ctx: { where: 'l1.estimateGas', to: baseToken },
                  message: 'Failed to estimate gas for ERC-20 approval.',
                }),
            },
          );
          if (approveGas.recommended != null) {
            approveTx.gasLimit = approveGas.recommended;
          }
          steps.push({
            key: `approve:${baseToken}:${ctx.l1AssetRouter}`,
            kind: 'approve',
            description: 'Approve base token for mintValue',
            tx: approveTx,
          });
        }
      }

      const req = buildDirectRequestStruct({
        chainId: ctx.chainIdL2,
        mintValue,
        l2GasLimit: ctx.l2GasLimit,
        gasPerPubdata: ctx.gasPerPubdata,
        refundRecipient: ctx.refundRecipient,
        l2Contract: (() => {
          const target = (p.to ?? sender) as Address | undefined;
          if (!target) {
            throw new Error(
              'Deposits require a target L2 address. Provide params.to when no sender account is available.',
            );
          }
          return target;
        })(),
        l2Value,
      });

      const data = new Contract(
        ctx.bridgehub,
        IBridgehubABI,
        ctx.client.l1,
      ).interface.encodeFunctionData('requestL2TransactionDirect', [req]);

      const tx: TransactionRequest = {
        to: ctx.bridgehub,
        data,
        value: 0n, // base token is ERC-20 ⇒ msg.value MUST be 0
        ...ctx.fee,
      };
      if (sender) {
        tx.from = sender;
      }

      const gas = await ctx.gas.ensure(
        'bridgehub:direct:erc20-base',
        'deposit.bridgehub.direct.l1',
        tx,
        {
          estimator: (request) =>
            wrapAs('RPC', OP_DEPOSITS.base.estGas, () => ctx.client.l1.estimateGas(request), {
              ctx: { where: 'l1.estimateGas', to: ctx.bridgehub },
              message: 'Failed to estimate gas for Bridgehub request.',
            }),
        },
      );
      if (gas.recommended != null) {
        tx.gasLimit = gas.recommended;
      }

      steps.push({
        key: 'bridgehub:direct:erc20-base',
        kind: 'bridgehub:direct',
        description: 'Bridge base ERC-20 via Bridgehub.requestL2TransactionDirect',
        tx,
      });

      return {
        steps,
        approvals,
        quoteExtras: { baseCost, mintValue, gasPlan: ctx.gas.snapshot() },
      };
    },
  };
}
