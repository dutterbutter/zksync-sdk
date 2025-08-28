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

export function routeErc20Base(): RouteStrategy {
  return {
    async build(p, ctx) {
      const bh = new Contract(ctx.bridgehub, IBridgehubAbi, ctx.client.l1);
      const router = await resolveAssetRouter(ctx.client, ctx.bridgehub);

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
          description: `Approve ${p.amount} for router`,
          canSkip: false,
          tx: { to: p.token, data, from: ctx.sender, ...ctx.fee }
        });
      }

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
      try { const est = await ctx.client.l1.estimateGas(bridgeTx); bridgeTx.gasLimit = pct(est, 15); } catch {
        // ignore
      }

      steps.push({
        key: 'bridgehub:two-bridges',
        kind: 'bridgehub:two-bridges',
        description: 'Bridge ERC20 via Bridgehub.requestL2TransactionTwoBridges',
        canSkip: false,
        tx: bridgeTx
      });

      return { steps, approvals, baseCost, mintValue };
    }
  };
}
