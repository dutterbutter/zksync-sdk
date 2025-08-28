/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import type { RouteStrategy } from "./types";
import { Contract } from "ethers";
import type { TransactionRequest } from "ethers";
import { resolveAssetRouter, encodeSecondBridgeErc20Args, pct } from "../../helpers";
import { ERC20Abi, IBridgehubAbi } from "../../../internal/abis";
import type { ApprovalNeed, PlanStep } from "../../../../../types/deposits";

export function routeErc20NonBase(): RouteStrategy {
  return {
    async preflight(p, ctx) {
      // Example: validate token is not the base token for this L2
      // const baseToken = await resolveBaseToken(ctx.client, ctx.bridgehub, ctx.chainIdL2);
      // if (eqAddr(baseToken, p.token)) throw new Error('non-base route requires a non-base token');
    },
    async build(p, ctx) {
      const bh = new Contract(ctx.bridgehub, IBridgehubAbi, ctx.client.l1);
      const router = await resolveAssetRouter(ctx.client, ctx.bridgehub); // or a different router getter

      const erc20 = new Contract(p.token, ERC20Abi, ctx.client.signer);
      const allowance: bigint = await erc20.allowance(ctx.sender, router);
      const needsApprove = allowance < p.amount;

      const baseCost = BigInt(
        await bh.l2TransactionBaseCost(ctx.chainIdL2, ctx.fee.gasPriceForBaseCost, ctx.l2GasLimit, ctx.gasPerPubdata)
      );
      const mintValue = baseCost + ctx.operatorTip;

      const approvals: ApprovalNeed[] = [];
      const steps: PlanStep[] = [];

      if (needsApprove) {
        approvals.push({ token: p.token, spender: router, amount: p.amount });
        const data = erc20.interface.encodeFunctionData('approve', [router, p.amount]);
        steps.push({
          key: `approve:${p.token}:${router}`,
          kind: 'approve',
          description: `Approve ${p.amount} for router (non-base)`,
          canSkip: false,
          tx: { to: p.token, data, from: ctx.sender, ...ctx.fee }
        });
      }

      // TODO: update calldata encoding if non-base requires different tuple/selector
      const secondBridgeCalldata = encodeSecondBridgeErc20Args(p.token, p.amount, p.to ?? ctx.sender);

      const outer = {
        chainId: ctx.chainIdL2,
        mintValue,
        l2Value: 0n,
        l2GasLimit: ctx.l2GasLimit,
        l2GasPerPubdataByteLimit: ctx.gasPerPubdata,
        refundRecipient: ctx.refundRecipient,
        secondBridgeAddress: router,
        secondBridgeValue: 0n,
        secondBridgeCalldata,
      } as const;

      const dataTwo = bh.interface.encodeFunctionData('requestL2TransactionTwoBridges', [outer]);
      const bridgeTx: TransactionRequest = { to: ctx.bridgehub, data: dataTwo, value: mintValue, from: ctx.sender, ...ctx.fee };
      try { const est = await ctx.client.l1.estimateGas(bridgeTx); bridgeTx.gasLimit = pct(est, 15); } catch {}

      steps.push({
        key: 'bridgehub:two-bridges:nonbase',
        kind: 'bridgehub:two-bridges',
        description: 'Bridge ERC20 (non-base) via Bridgehub.requestL2TransactionTwoBridges',
        canSkip: false,
        tx: bridgeTx
      });

      return { steps, approvals, baseCost, mintValue };
    }
  };
}
