//core/withdrawals/route.ts
import type { Address } from '../../types/primitives';
import type { WithdrawRoute } from '../../types/flows/withdrawals';
import { isETH, normalizeAddrEq } from '../../utils/addr';

export function pickWithdrawRoute(token: Address, baseToken: Address): WithdrawRoute {
  if (isETH(token)) {
    return isETH(baseToken) ? 'eth-base' : 'eth-nonbase';
  }
  return normalizeAddrEq(token, baseToken) ? 'erc20-base' : 'erc20-nonbase';
}
