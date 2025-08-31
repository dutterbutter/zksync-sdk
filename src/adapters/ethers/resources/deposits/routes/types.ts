// src/adapters/ethers/resources/deposits/routes/types.ts
import type { TransactionRequest } from 'ethers';
import type { DepositParams } from '../../../../../types/flows/deposits';
import type { RouteStrategy } from '../../../../../types/flows/route';
import type { BuildCtx as DepositBuildCtx } from '../context';

// What the route wants to add to the final quote
export type DepositQuoteExtras = {
  baseCost: bigint;
  mintValue: bigint;
};

export type DepositRouteStrategy = RouteStrategy<
  DepositParams,
  TransactionRequest,
  DepositQuoteExtras,
  DepositBuildCtx
>;
