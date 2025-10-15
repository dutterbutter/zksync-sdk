import type { TransactionRequest } from 'ethers';
import type { ApprovalNeed, PlanStep } from '../../../../../core/types/flows/base';
import type { InteropParams, InteropRoute } from '../../../../../core/types/flows/interop';
import type { InteropEthersContext } from '../types';

/** Build context for route strategies:
 *  - the picked route (direct | router)
 *  - the ethers interop context (providers, chain ids, addresses, ifaces, base tokens)
 */
export type BuildCtx = InteropEthersContext & { route: InteropRoute };

/** Quote add-ons a route can compute */
export interface QuoteExtras {
  /** Sum of msg.value across actions (sendNative + call.value). */
  totalActionValue: bigint;
  /** Sum of ERC-20 amounts across actions (for approvals/bridging). */
  bridgedTokenTotal: bigint;
  /** Optional fee estimates . */
  l1Fee?: bigint;
  l2Fee?: bigint;
}

/** Route strategy contract (mirrors deposits style). */
export interface InteropRouteStrategy {
  /** Optional preflight checks. Throw with a descriptive message on invalid inputs. */
  preflight?(p: InteropParams, ctx: BuildCtx): Promise<void> | void;

  /** Build the plan steps + approvals + quote extras. */
  build(
    p: InteropParams,
    ctx: BuildCtx,
  ): Promise<{
    steps: Array<PlanStep<TransactionRequest>>;
    approvals: ApprovalNeed[];
    quoteExtras: QuoteExtras;
  }>;
}
