// src/adapters/ethers/sdk.ts
import type { EthersClient } from './client';
import {
  DepositsResource,
  type DepositsResource as DepositsResourceType,
} from './resources/deposits/index';
import {
  WithdrawalsResource,
  type WithdrawalsResource as WithdrawalsResourceType,
} from './resources/withdrawals/index';

export interface EthersSdk {
  deposits: DepositsResourceType;
  withdrawals: WithdrawalsResourceType;
}

export function createEthersSdk(client: EthersClient): EthersSdk {
  return {
    deposits: DepositsResource(client),
    withdrawals: WithdrawalsResource(client),
  };
}
