// src/adapters/ethers/resources/deposits/routes/types.ts
import type { TransactionRequest } from 'ethers';
import type { DepositParams } from '../../../../../core/types/flows/deposits';
import type { RouteStrategy } from '../../../../../core/types/flows/route';
import type { BuildCtx as DepositBuildCtx } from '../context';
import type { GasPlannerSnapshot } from '../../../../../core/gas';

// Extra data returned from quote step, passed to build step
export interface DepositQuoteExtras {
  baseCost: bigint;
  mintValue: bigint;
  gasPlan: GasPlannerSnapshot;
  baseToken?: string;
  baseIsEth?: boolean;
}

// A Deposit route strategy for building a deposit transaction request
export type DepositRouteStrategy = RouteStrategy<
  DepositParams,
  TransactionRequest,
  DepositQuoteExtras,
  DepositBuildCtx
>;
