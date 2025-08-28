/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import type { RouteStrategy } from "./types";
import { Contract } from "ethers";
import type { TransactionRequest } from "ethers";
import { pct, buildDirectRequestStruct } from "../../helpers";
import { IBridgehubAbi } from "../../../internal/abis";
import type { PlanStep } from "../../../../../types/deposits";

export function routeEthDirect(): RouteStrategy {
  return {
    async build(p, ctx) {
      const bh = new Contract(ctx.bridgehub, IBridgehubAbi, ctx.client.l1);
      const baseCost = BigInt(
        await bh.l2TransactionBaseCost(ctx.chainIdL2, ctx.fee.gasPriceForBaseCost, ctx.l2GasLimit, ctx.gasPerPubdata)
      );

      const l2Contract = (p.to ?? ctx.sender);
      const l2Value = p.amount;
      const mintValue = baseCost + ctx.operatorTip + l2Value;

      const req = buildDirectRequestStruct({
        chainId: ctx.chainIdL2,
        mintValue,
        l2GasLimit: ctx.l2GasLimit,
        gasPerPubdata: ctx.gasPerPubdata,
        refundRecipient: ctx.refundRecipient,
        l2Contract,
        l2Value,
      });

      const data = bh.interface.encodeFunctionData('requestL2TransactionDirect', [req]);
      const tx: TransactionRequest = { to: ctx.bridgehub, data, value: mintValue, from: ctx.sender, ...ctx.fee };
      try { const est = await ctx.client.l1.estimateGas(tx); tx.gasLimit = pct(est, 15); } catch {
        // ignore
      }

      const steps: PlanStep[] = [{
        key: 'bridgehub:direct',
        kind: 'bridgehub:direct',
        description: 'Bridge ETH via Bridgehub.requestL2TransactionDirect',
        canSkip: false,
        tx
      }];

      return { steps, approvals: [], baseCost, mintValue };
    }
  };
}
