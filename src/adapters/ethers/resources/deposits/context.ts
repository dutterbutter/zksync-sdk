/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// context.ts
import { type TransactionRequest, Contract } from 'ethers';
import type { EthersClient } from '../../client';
import type { Address } from '../../../../types/primitives';
import { getFeeOverrides } from '../helpers';
import { pickRouteSmart } from '../helpers';
import type { DepositParams, DepositRoute } from '../../../../types/flows/deposits';
import type { CommonCtx } from '../../../../types/flows/base';
import IBridgehubABI from '../../../../internal/abis/IBridgehub.json' assert { type: 'json' };

export interface BuildCtx extends CommonCtx {
  client: EthersClient;

  //
  l1AssetRouter: Address;

  fee: Partial<TransactionRequest> & { gasPriceForBaseCost: bigint };
  l2GasLimit: bigint;
  gasPerPubdata: bigint;
  operatorTip: bigint;
  refundRecipient: Address;
}

export async function commonCtx(p: DepositParams, client: EthersClient) {
  const { bridgehub } = await client.ensureAddresses();
  const bh = new Contract(bridgehub, IBridgehubABI, client.l1);
  const l1AssetRouter = (await bh.assetRouter()) as Address;
  const { chainId } = await client.l2.getNetwork();
  const sender = (await client.signer.getAddress()) as Address;
  const fee = await getFeeOverrides(client);

  const l2GasLimit = p.l2GasLimit ?? 300_000n;
  const gasPerPubdata = p.gasPerPubdata ?? 800n;
  const operatorTip = p.operatorTip ?? 0n;
  const refundRecipient = p.refundRecipient ?? sender;

  const route = await pickRouteSmart(client, bridgehub, BigInt(chainId), p.token);

  return {
    client,
    l1AssetRouter,
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
