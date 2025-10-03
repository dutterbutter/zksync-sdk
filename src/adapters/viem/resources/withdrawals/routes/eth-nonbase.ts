import type { WithdrawRouteStrategy, ViemPlanWriteRequest } from './types';
import type { PlanStep } from '../../../../../core/types/flows/base';
import {
  L2NativeTokenVaultABI,
  IL2AssetRouterABI,
} from '../../../../../core/internal/abi-registry.ts';
import { createErrorHandlers } from '../../../errors/error-ops';
import { OP_WITHDRAWALS } from '../../../../../core/types';
import { ETH_ADDRESS } from '../../../../../core/constants';
import { isETH } from '../../../../../core/utils/addr';
import { encodeAbiParameters, type Abi } from 'viem';

const { wrapAs } = createErrorHandlers('withdrawals');

// Withdraw ETH on a chain whose base token is NOT ETH.
// Uses L2NativeTokenVault + L2AssetRouter.withdraw(assetId, assetData).
export function routeEthNonBase(): WithdrawRouteStrategy {
  return {
    async preflight(p, ctx) {
      await wrapAs(
        'VALIDATION',
        OP_WITHDRAWALS.ethNonBase.assertNonEthBase,
        () => {
          if (!isETH(p.token)) {
            throw new Error('eth-nonbase route requires ETH (token == ETH sentinel).');
          }
          if (ctx.baseIsEth) {
            throw new Error('eth-nonbase route requires base token ≠ ETH on target L2.');
          }
        },
        { ctx: { token: p.token, baseIsEth: ctx.baseIsEth } },
      );
    },

    async build(p, ctx) {
      const steps: Array<PlanStep<ViemPlanWriteRequest>> = [];

      // 1) assetId = ensureTokenIsRegistered(ETH)
      const assetId = await wrapAs(
        'CONTRACT',
        OP_WITHDRAWALS.erc20.ensureRegistered, // reuse context tag
        () =>
          ctx.client.l2.readContract({
            address: ctx.l2NativeTokenVault,
            abi: L2NativeTokenVaultABI as Abi,
            functionName: 'ensureTokenIsRegistered',
            args: [ETH_ADDRESS],
          }),
        {
          ctx: { where: 'L2NativeTokenVault.ensureTokenIsRegistered', token: 'ETH' },
          message: 'Failed to ensure ETH is registered in L2NativeTokenVault.',
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
              [p.amount, to, ETH_ADDRESS],
            ),
          ),
        {
          ctx: { where: 'encodeAbiParameters', token: 'ETH', to },
          message: 'Failed to encode ETH withdraw asset data.',
        },
      );

      // 3) L2AssetRouter.withdraw(assetId, assetData)
      const withdrawReq: ViemPlanWriteRequest = {
        address: ctx.l2AssetRouter,
        abi: IL2AssetRouterABI,
        functionName: 'withdraw',
        args: [assetId as `0x${string}`, assetData],
        account: ctx.client.account,
      };

      steps.push({
        key: 'l2-asset-router:withdraw:eth-nonbase',
        kind: 'l2-asset-router:withdraw',
        description: 'Withdraw ETH via L2 NativeTokenVault / AssetRouter (base ≠ ETH)',
        tx: withdrawReq,
      });

      return { steps, approvals: [], quoteExtras: {} };
    },
  };
}
