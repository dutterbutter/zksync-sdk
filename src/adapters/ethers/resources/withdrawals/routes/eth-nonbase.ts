// src/adapters/ethers/resources/withdrawals/routes/eth-nonbase.ts
import { Contract, AbiCoder, type TransactionRequest } from 'ethers';
import type { WithdrawRouteStrategy } from './types';
import type { PlanStep, ApprovalNeed } from '../../../../../core/types/flows/base';
import {
  IL2AssetRouterABI,
  L2NativeTokenVaultABI,
  IERC20ABI,
  IBridgehubABI,
} from '../../../../../core/internal/abi-registry';
import { createErrorHandlers } from '../../../errors/error-ops';
import { OP_WITHDRAWALS } from '../../../../../core/types';
import { isETH } from '../../../../../core/utils/addr';

const { wrapAs } = createErrorHandlers('withdrawals');

const SIG = { withdraw: 'withdraw(bytes32,bytes)' } as const;

export function routeEthNonBase(): WithdrawRouteStrategy {
  return {
    async preflight(p, ctx) {
      // Base token must not be ETH on target chain
      const bh = new Contract(ctx.bridgehub, IBridgehubABI, ctx.client.l1);
      const baseToken = (await wrapAs(
        'CONTRACT',
        OP_WITHDRAWALS.ethNonBase.baseToken,
        () => bh.baseToken(ctx.chainIdL2),
        { ctx: { where: 'bridgehub.baseToken', chainIdL2: ctx.chainIdL2 } },
      )) as `0x${string}`;

      await wrapAs(
        'VALIDATION',
        OP_WITHDRAWALS.ethNonBase.assertNonEthBase,
        () => {
          if (isETH(baseToken)) {
            throw new Error('eth-nonbase withdrawal requires target chain base token ≠ ETH.');
          }
        },
        { ctx: { baseToken } },
      );

      return;
    },

    async build(p, ctx) {
      const steps: Array<PlanStep<TransactionRequest>> = [];
      const approvals: ApprovalNeed[] = [];

      // L2 “ETH” here is an ERC-20-like token (p.token) managed by NTV
      const l2Signer = ctx.client.signer.connect(ctx.client.l2);
      const erc20 = new Contract(p.token, IERC20ABI, l2Signer);

      const allowance = (await wrapAs(
        'CONTRACT',
        OP_WITHDRAWALS.ethNonBase.allowance,
        () => erc20.allowance(ctx.sender, ctx.l2NativeTokenVault),
        {
          ctx: { where: 'erc20.allowance', token: p.token, spender: ctx.l2NativeTokenVault },
          message: 'Failed to read L2 allowance for L2-ETH token.',
        },
      )) as bigint;

      if (allowance < p.amount) {
        approvals.push({ token: p.token, spender: ctx.l2NativeTokenVault, amount: p.amount });
        const data = erc20.interface.encodeFunctionData('approve', [
          ctx.l2NativeTokenVault,
          p.amount,
        ]);
        steps.push({
          key: `approve:l2:${p.token}:${ctx.l2NativeTokenVault}`,
          kind: 'approve:l2',
          description: `Approve L2 ETH token to NativeTokenVault`,
          tx: { to: p.token, data, from: ctx.sender, ...(ctx.fee ?? {}) },
        });
      }

      // ensureRegistered + assetData
      const ntv = new Contract(ctx.l2NativeTokenVault, L2NativeTokenVaultABI, ctx.client.l2);
      const assetId = (await wrapAs(
        'CONTRACT',
        OP_WITHDRAWALS.ethNonBase.ensureRegistered,
        () => ntv.getFunction('ensureTokenIsRegistered').staticCall(p.token),
        {
          ctx: { where: 'L2NativeTokenVault.ensureTokenIsRegistered', token: p.token },
          message: 'Failed to ensure L2-ETH token is registered.',
        },
      )) as `0x${string}`;

      const assetData = await wrapAs(
        'INTERNAL',
        OP_WITHDRAWALS.ethNonBase.encodeAssetData,
        () =>
          Promise.resolve(
            AbiCoder.defaultAbiCoder().encode(
              ['uint256', 'address', 'address'],
              [p.amount, p.to ?? ctx.sender, p.token],
            ),
          ),
        {
          ctx: { token: p.token, to: p.to ?? ctx.sender },
          message: 'Failed to encode burn/withdraw asset data (L2 ETH).',
        },
      );

      // L2AssetRouter.withdraw(assetId, assetData)
      const l2ar = new Contract(ctx.l2AssetRouter, IL2AssetRouterABI, ctx.client.l2);
      const dataWithdraw = await wrapAs(
        'INTERNAL',
        OP_WITHDRAWALS.ethNonBase.encodeWithdraw,
        () =>
          Promise.resolve(l2ar.interface.encodeFunctionData(SIG.withdraw, [assetId, assetData])),
        { ctx: { where: 'L2AssetRouter.withdraw', assetId } },
      );

      const withdrawTx: TransactionRequest = {
        to: ctx.l2AssetRouter,
        data: dataWithdraw,
        from: ctx.sender,
        ...(ctx.fee ?? {}),
      };

      steps.push({
        key: 'l2-asset-router:withdraw:eth-nonbase',
        kind: 'l2-asset-router:withdraw',
        description: 'Withdraw ETH (base ≠ ETH) via L2AssetRouter + NativeTokenVault',
        tx: withdrawTx,
      });

      return { steps, approvals, quoteExtras: {} };
    },
  };
}
