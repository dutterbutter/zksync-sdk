import type { Address } from '../types/primitives';
import { WithdrawRoute } from '../types/flows/withdrawals';
import { isETH } from '../utils/addr';

/** Route picker for withdrawals: ETH uses base-token system contract; ERC-20 uses L2AssetRouter */
export function pickWithdrawRoute(token: Address): WithdrawRoute {
  return isETH(token) ? 'eth' : 'erc20';
}