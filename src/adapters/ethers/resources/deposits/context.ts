/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// context.ts
import { type TransactionRequest } from 'ethers';
import type { EthersClient } from '../../client';
import type { Address } from '../../../../types/primitives';
import { getFeeOverrides } from '../helpers';
import { pickRouteSmart } from '../helpers';
import type { DepositParams, DepositRoute } from '../../../../types/deposits';

export interface BuildCtx {
  client: EthersClient;
  bridgehub: Address;
  chainIdL2: bigint;
  sender: Address;
  fee: Partial<TransactionRequest> & { gasPriceForBaseCost: bigint };
  l2GasLimit: bigint;
  gasPerPubdata: bigint;
  operatorTip: bigint;
  refundRecipient: Address;
}

export async function commonCtx(p: DepositParams, client: EthersClient) {
  const { bridgehub } = await client.ensureAddresses();
  const { chainId } = await client.l2.getNetwork();
  const sender = await client.signer.getAddress() as Address;
  const fee = await getFeeOverrides(client);

  const l2GasLimit = p.l2GasLimit ?? 300_000n;
  const gasPerPubdata = p.gasPerPubdata ?? 800n;
  const operatorTip = p.operatorTip ?? 0n;
  const refundRecipient = p.refundRecipient ?? sender;

  const route = await pickRouteSmart(client, bridgehub, BigInt(chainId), p.token);

  return {
    client,
    route,
    bridgehub,
    chainIdL2: BigInt(chainId),
    sender,
    fee,
    l2GasLimit,
    gasPerPubdata,
    operatorTip,
    refundRecipient,
  } satisfies BuildCtx & { route: DepositRoute };
}
