// src/adapters/ethers/sdk.ts
import type { EthersClient } from './client';
import { DepositsResource, DepositsResource as DepositsResourceType } from './resources/deposits';

export interface EthersSdk {
  deposits: DepositsResourceType;
  // later: withdrawals, finality, interop, allowances...
}

export function createEthersSdk(client: EthersClient): EthersSdk {
  return {
    deposits: DepositsResource(client),
  };
}
