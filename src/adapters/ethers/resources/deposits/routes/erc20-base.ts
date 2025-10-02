import type { DepositRouteStrategy } from './types';
import { Contract } from 'ethers';
import type { TransactionRequest } from 'ethers';
import { IBridgehubABI, IERC20ABI } from '../../../../../core/internal/abi-registry.ts';
import { buildDirectRequestStruct } from '../../utils';
import type { ApprovalNeed, PlanStep } from '../../../../../core/types/flows/base';
import { createErrorHandlers } from '../../../errors/error-ops';
import { OP_DEPOSITS } from '../../../../../core/types';
import { normalizeAddrEq, isETH } from '../../../../../core/utils/addr';

// error handling
const { wrapAs } = createErrorHandlers('deposits');
const BASE_COST_BUFFER_BPS = 100n; // 1%
const BPS = 10_000n;
const withBuffer = (x: bigint) => (x * (BPS + BASE_COST_BUFFER_BPS)) / BPS;

/**
 * ERC20 deposit where the deposit token IS the target chain's base token (base ≠ ETH).
 *
 * Flow:
 * - Uses Bridgehub.requestL2TransactionDirect (single bridge).
 * - msg.value MUST be 0 when base token is ERC-20 (Bridgehub enforces this).
 * - User must approve the base token to L1AssetRouter for `mintValue = baseCost + tip + amount`.
 * - L2 receives `l2Value = amount` to `l2Contract = to || sender`.
 */
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

      // Ensure the provided ERC-20 is indeed the base token of the target chain.
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

      // Source of truth: read base token again (cheap & defensive)
      const baseToken = (await wrapAs(
        'CONTRACT',
        OP_DEPOSITS.base.baseToken,
        () => bh.baseToken(ctx.chainIdL2),
        {
          ctx: { where: 'bridgehub.baseToken', chainIdL2: ctx.chainIdL2 },
          message: 'Failed to read base token.',
        },
      )) as `0x${string}`;

      // Base cost (L2 fee)
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

      // For direct requests, mintValue must cover fees + the L2 msg.value (amount)
      const l2Value = p.amount;
      const rawMintValue = baseCost + ctx.operatorTip + l2Value;
      const mintValue = withBuffer(rawMintValue); 

      const approvals: ApprovalNeed[] = [];
      const steps: PlanStep<TransactionRequest>[] = [];

      // Approval: base token → L1AssetRouter for mintValue
      {
        const erc20 = new Contract(baseToken, IERC20ABI, ctx.client.signer.connect(ctx.client.l1));
        const allowance = (await wrapAs(
          'RPC',
          OP_DEPOSITS.base.allowance,
          () => erc20.allowance(ctx.sender, ctx.l1AssetRouter),
          {
            ctx: { where: 'erc20.allowance', token: baseToken, spender: ctx.l1AssetRouter },
            message: 'Failed to read base-token allowance.',
          },
        )) as bigint;

        if (allowance < mintValue) {
          approvals.push({ token: baseToken, spender: ctx.l1AssetRouter, amount: mintValue });
          const data = erc20.interface.encodeFunctionData('approve', [
            ctx.l1AssetRouter,
            mintValue,
          ]);
          steps.push({
            key: `approve:${baseToken}:${ctx.l1AssetRouter}`,
            kind: 'approve',
            description: 'Approve base token for mintValue',
            tx: { to: baseToken, data, from: ctx.sender, ...ctx.fee },
          });
        }
      }

      // Build the direct request
      const req = buildDirectRequestStruct({
        chainId: ctx.chainIdL2,
        mintValue, // pulled in base token by L1AssetRouter
        l2GasLimit: ctx.l2GasLimit,
        gasPerPubdata: ctx.gasPerPubdata,
        refundRecipient: ctx.refundRecipient,
        l2Contract: p.to ?? ctx.sender,
        l2Value, // amount of base token to deliver on L2
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
        from: ctx.sender,
        ...ctx.fee,
      };

      try {
        const est = await wrapAs(
          'RPC',
          OP_DEPOSITS.base.estGas,
          () => ctx.client.l1.estimateGas(tx),
          {
            ctx: { where: 'l1.estimateGas', to: ctx.bridgehub },
            message: 'Failed to estimate gas for Bridgehub request.',
          },
        );
        tx.gasLimit = (BigInt(est) * 115n) / 100n;
      } catch {
        // ignore;
      }

      steps.push({
        key: 'bridgehub:direct:erc20-base',
        kind: 'bridgehub:direct',
        description: 'Bridge base ERC-20 via Bridgehub.requestL2TransactionDirect',
        tx,
      });

      return { steps, approvals, quoteExtras: { baseCost, mintValue } };
    },
  };
}
