// src/adapters/ethers/resources/deposits/routes/types.ts
import type { TransactionRequest } from 'ethers';
import type { DepositParams } from '../../../../../core/types/flows/deposits';
import type { RouteStrategy } from '../../../../../core/types/flows/route';
import type { BuildCtx as DepositBuildCtx } from '../context';

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
