import type { DepositParams, PlanStep, ApprovalNeed } from "../../../../../types/deposits";
import type { BuildCtx } from "../context";

export interface RouteStrategy {
  preflight?(p: DepositParams, ctx: BuildCtx): Promise<void>;
  build(p: DepositParams, ctx: BuildCtx): Promise<{
    steps: PlanStep[];
    approvals: ApprovalNeed[];
    baseCost: bigint;
    mintValue: bigint;
  }>;
}


