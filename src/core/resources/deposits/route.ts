import type { Address } from '../../types/primitives';
import type { DepositRoute } from '../../types/flows/deposits';
import { isETH } from '../../utils/addr';

export interface BaseTokenLookup {
  baseToken(chainId: bigint): Promise<Address>;
}

// TODO: add 'erc20-base' route when supported
// Route picker for deposits:
// ETH: ETH as base token
// ERC-20-base: ERC-20 as base token
// ERC-20-nonbase: ERC-20 not as base token, asset transfer
export function pickDepositRoute(
  client: BaseTokenLookup,
  chainIdL2: bigint,
  token: Address,
): DepositRoute {
  if (isETH(token)) return 'eth';

  // ERC20: check if it is the base token on the target L2
  //const base = await client.baseToken(chainIdL2);
  // TODO: re-enable base-token route when supported
  //return normalizeAddrEq(token, base) ? 'erc20-base' : 'erc20-nonbase';
  return 'erc20-nonbase';
}
