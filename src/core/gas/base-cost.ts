import type { ReadProvider } from '../interfaces';
import type { Address } from '../../types/primitives';
import { encodeFunctionCall } from '../../internal/abi';

export async function fetchBaseCost(
  l1: ReadProvider,
  bridgehub: Address,
  chainId: bigint,
  gasLimit: bigint,
  gasPerPubdata: bigint,
): Promise<bigint> {
  const data = encodeFunctionCall(
    'l2TransactionBaseCost(uint256,uint256,uint256)',
    ['uint256', 'uint256', 'uint256'],
    [chainId, gasLimit, gasPerPubdata],
  );
  const raw = await l1.call({ to: bridgehub, data });
  return raw && raw !== '0x' ? BigInt(raw) : 0n;
}
