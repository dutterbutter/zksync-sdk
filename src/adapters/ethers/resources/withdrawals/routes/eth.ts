// src/adapters/ethers/resources/withdrawals/routes/eth.ts
import { Contract, Interface, type TransactionRequest } from 'ethers';
import type { WithdrawRouteStrategy } from './types';
import type { PlanStep } from '../../../../../core/types/flows/base';
import { L2_BASE_TOKEN_SYSTEM_CONTRACT_ADDR } from '../../../../../core/constants';
import L2BaseTokenABI from '../../../../../internal/abis/IBaseToken.json' assert { type: 'json' };

// const L2BaseTokenSystemAbi = [
//   // NOTE: single-arg payable signature; amount is msg.value
//   'function withdraw(address _l1Receiver) external payable',
// ] as const;

export function routeEth(): WithdrawRouteStrategy {
  return {
    async build(p, ctx) {
      const steps: Array<PlanStep<TransactionRequest>> = [];

      const base = new Contract(
        L2_BASE_TOKEN_SYSTEM_CONTRACT_ADDR,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        new Interface(L2BaseTokenABI),
        ctx.client.l2,
      );

      const toL1 = p.to ?? ctx.sender;
      const data = base.interface.encodeFunctionData('withdraw', [toL1]);

      const tx: TransactionRequest = {
        to: L2_BASE_TOKEN_SYSTEM_CONTRACT_ADDR,
        data,
        from: ctx.sender,
        value: p.amount,
        // Do not carry L1 fee overrides to L2; leave fees empty for provider to fill.
      };

      // TODO: improve gas estimations
      try {
        const est = await ctx.client.l2.estimateGas(tx);
        tx.gasLimit = (est * 115n) / 100n; // +15% buffer
      } catch {
        // tx.gasLimit = 200_000n; // fallback
      }

      steps.push({
        key: 'l2-base-token:withdraw',
        kind: 'l2-base-token:withdraw',
        description: 'Withdraw ETH via L2 Base Token System',
        tx,
      });

      return { steps, approvals: [], quoteExtras: {} };
    },
  };
}
