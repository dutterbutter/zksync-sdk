import type { Address } from '../types/primitives';
import type { DepositRoute } from '../types/flows/deposits';
import { isETH, normalizeAddrEq } from '../utils/addr';

// Minimal interface the helper needs from any client
export interface BaseTokenLookup {
  baseToken(chainId: bigint): Promise<Address>;
}

// Route picker for deposits:
// ETH: ETH as base token
// ERC-20-base: ERC-20 as base token
// ERC-20-nonbase: ERC-20 not as base token, asset transfer
export async function pickDepositRoute(
  client: BaseTokenLookup,
  chainIdL2: bigint,
  token: Address,
): Promise<DepositRoute> {
  if (isETH(token)) return 'eth';

  // ERC20: check if it is the base token on the target L2
  const base = await client.baseToken(chainIdL2);
  return normalizeAddrEq(token, base) ? 'erc20-base' : 'erc20-nonbase';
}
