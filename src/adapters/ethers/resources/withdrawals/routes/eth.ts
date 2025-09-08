// src/adapters/ethers/resources/withdrawals/routes/eth.ts
import { Contract, Interface, type TransactionRequest } from 'ethers';
import type { WithdrawRouteStrategy } from './types';
import type { PlanStep } from '../../../../../core/types/flows/base';
import { L2_BASE_TOKEN_SYSTEM_CONTRACT_ADDR } from '../../../../../core/constants';

const L2BaseTokenSystemAbi = [
  // NOTE: single-arg payable signature; amount is msg.value
  'function withdraw(address _l1Receiver) external payable',
] as const;

export function routeEth(): WithdrawRouteStrategy {
  return {
    async build(p, ctx) {
      const steps: Array<PlanStep<TransactionRequest>> = [];

      // Build tx to the L2 Base Token System (system predeploy)
      const base = new Contract(
        L2_BASE_TOKEN_SYSTEM_CONTRACT_ADDR,
        new Interface(L2BaseTokenSystemAbi),
        ctx.client.l2,
      );

      const toL1 = p.to ?? ctx.sender;
      const data = base.interface.encodeFunctionData('withdraw', [toL1]);

      const tx: TransactionRequest = {
        to: L2_BASE_TOKEN_SYSTEM_CONTRACT_ADDR,
        data,
        from: ctx.sender,
        value: p.amount,
        // Do NOT carry L1 fee overrides to L2; leave fees empty for provider to fill.
      };

      // Best-effort gas prefill: some providers can’t estimate system contracts; fallback to a sane default.
      try {
        const est = await ctx.client.l2.estimateGas(tx);
        tx.gasLimit = (est * 115n) / 100n; // +15% buffer
      } catch {
        // tx.gasLimit = 200_000n; // fallback for nodes that can’t estimate system contracts
      }

      steps.push({
        key: 'l2-base-token:withdraw',
        kind: 'l2-asset-router:withdraw', // keep kind to reuse UI buckets; it’s an L2 withdraw step
        description: 'Withdraw ETH via L2 Base Token System',
        canSkip: false,
        tx,
      });

      return { steps, approvals: [], quoteExtras: {} };
    },
  };
}
