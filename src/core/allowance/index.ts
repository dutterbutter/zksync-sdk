import type { Address } from '../../types/primitives';
import type { ReadProvider } from '../interfaces';
import { encodeFunctionCall } from '../../internal/abi';
import { buildTx, type BuiltTx } from '../../internal/evm';

/**
 * Fetch current allowance for (owner, spender) on ERC20.
 */
export async function getAllowance(
  provider: ReadProvider,
  token: Address,
  owner: Address,
  spender: Address,
): Promise<bigint> {
  const data = encodeFunctionCall(
    'allowance(address,address)',
    ['address', 'address'],
    [owner, spender],
  );
  const raw = await provider.call({ to: token, data });
  if (!raw || raw === '0x') return 0n;
  return BigInt(raw);
}

export interface ApprovePlanOpts {
  policy?: 'exact' | 'infinite';
}

/**
 * Plan an approval tx for exact amount.
 */
export function planApproveExact(token: Address, spender: Address, amount: bigint): BuiltTx {
  const data = encodeFunctionCall(
    'approve(address,uint256)',
    ['address', 'uint256'],
    [spender, amount],
  );
  return buildTx(token, data);
}

/**
 * Plan an approval tx for max uint256.
 */
export function planApproveInfinite(token: Address, spender: Address): BuiltTx {
  const MAX = (1n << 256n) - 1n;
  const data = encodeFunctionCall(
    'approve(address,uint256)',
    ['address', 'uint256'],
    [spender, MAX],
  );
  return buildTx(token, data, 0n, { policy: 'infinite' });
}

/**
 * Given needs (token, spender, amount), return BuiltTxs if approvals required.
 */
export async function ensureApprovals(
  provider: ReadProvider,
  owner: Address,
  needs: readonly { token: Address; spender: Address; amount: bigint }[],
  opts?: ApprovePlanOpts,
): Promise<BuiltTx[]> {
  const out: BuiltTx[] = [];
  for (const need of needs) {
    const current = await getAllowance(provider, need.token, owner, need.spender);
    if (current < need.amount) {
      if (opts?.policy === 'infinite') {
        out.push(planApproveInfinite(need.token, need.spender));
      } else {
        out.push(planApproveExact(need.token, need.spender, need.amount));
      }
    }
  }
  return out;
}
