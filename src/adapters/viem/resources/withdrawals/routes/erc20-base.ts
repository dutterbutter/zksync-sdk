// src/adapters/viem/resources/withdrawals/routes/erc20-base.ts
import type { WithdrawRouteStrategy, ViemPlanWriteRequest } from './types';
import type { PlanStep } from '../../../../../core/types/flows/base';
import {
  IL2AssetRouterABI,
  L2NativeTokenVaultABI,
} from '../../../../../core/internal/abi-registry.ts';
import { createErrorHandlers } from '../../../errors/error-ops';
import { OP_WITHDRAWALS } from '../../../../../core/types';
import { isETH, normalizeAddrEq } from '../../../../../core/utils/addr';
import { encodeAbiParameters, type Abi } from 'viem';

const { wrapAs } = createErrorHandlers('withdrawals');

// Withdraw the BASE ERC-20 itself (e.g., SOPH) via AssetRouter.withdraw(bytes32,bytes)
export function routeErc20Base(): WithdrawRouteStrategy {
  return {
    async preflight(p, ctx) {
      await wrapAs(
        'VALIDATION',
        OP_WITHDRAWALS.base.assertErc20Base,
        () => {
          if (isETH(p.token)) throw new Error('erc20-base requires ERC-20 (not ETH).');
          if (ctx.baseIsEth) throw new Error('erc20-base requires base token ≠ ETH.');
        },
        { ctx: { token: p.token, baseIsEth: ctx.baseIsEth } },
      );

      await wrapAs(
        'VALIDATION',
        OP_WITHDRAWALS.base.assertMatches,
        () => {
          if (!normalizeAddrEq(p.token, ctx.baseToken)) {
            throw new Error('erc20-base requires token == chain base token.');
          }
        },
        { ctx: { token: p.token, baseToken: ctx.baseToken } },
      );
    },

    async build(p, ctx) {
      const steps: Array<PlanStep<ViemPlanWriteRequest>> = [];

      // 1) assetId = ensureTokenIsRegistered(baseToken) on NTV
      const assetId = await wrapAs(
        'CONTRACT',
        OP_WITHDRAWALS.erc20.ensureRegistered,
        () =>
          ctx.client.l2.readContract({
            address: ctx.l2NativeTokenVault,
            abi: L2NativeTokenVaultABI as Abi,
            functionName: 'ensureTokenIsRegistered',
            args: [ctx.baseToken],
          }),
        {
          ctx: { where: 'L2NativeTokenVault.ensureTokenIsRegistered', token: ctx.baseToken },
          message: 'Failed to ensure base token is registered in NTV.',
        },
      );

      // 2) assetData = abi.encode(uint256 amount, address to, address token)
      const to = p.to ?? ctx.sender;
      const assetData = await wrapAs(
        'INTERNAL',
        OP_WITHDRAWALS.erc20.encodeAssetData,
        () =>
          Promise.resolve(
            encodeAbiParameters(
              [
                { type: 'uint256', name: 'amount' },
                { type: 'address', name: 'l1Receiver' },
                { type: 'address', name: 'token' },
              ],
              [p.amount, to, ctx.baseToken],
            ),
          ),
        { ctx: { to, token: ctx.baseToken } },
      );

      // 3) L2AssetRouter.withdraw(assetId, assetData)
      const withdrawReq: ViemPlanWriteRequest = {
        address: ctx.l2AssetRouter,
        abi: IL2AssetRouterABI,
        functionName: 'withdraw', // SIG.withdraw
        args: [assetId as `0x${string}`, assetData],
        account: ctx.client.account,
      };

      steps.push({
        key: 'l2-asset-router:withdraw:erc20-base',
        kind: 'l2-asset-router:withdraw',
        description: 'Withdraw base ERC-20 via L2 AssetRouter',
        tx: withdrawReq,
      });

      return { steps, approvals: [], quoteExtras: {} };
    },
  };
}
