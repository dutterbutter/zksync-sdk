import type { Address } from "../types/primitives";
import type { DepositRoute } from "../types/flows/deposits";
import { isETH, normalizeAddrEq } from "../utils/addr";

// Minimal interface the helper needs from any client
export interface BaseTokenLookup {
  baseToken(chainId: bigint): Promise<Address>;
}

export async function pickRouteSmart(
  client: BaseTokenLookup,
  chainIdL2: bigint,
  token: Address,
): Promise<DepositRoute> {
  if (isETH(token)) return "eth";

  // ERC20: check if it is the base token on the target L2
  const base = await client.baseToken(chainIdL2);
  return normalizeAddrEq(token, base) ? "erc20-base" : "erc20-nonbase";
}
