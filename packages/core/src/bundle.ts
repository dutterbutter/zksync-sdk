import type { BundleItem } from './types';
import { ItemKind } from './types';

export const bundle = {
  /** ETH transfer */
  native: (p: { to: `0x${string}`; amount: bigint }) =>
    ({ kind: ItemKind.NativeTransfer, ...p }) as const satisfies BundleItem,

  /** ERC-20 transfer */
  erc20: (p: {
    token: `0x${string}`;
    to: `0x${string}`;
    amount: bigint;
    indirect?: boolean;
    bridgeMsgValue?: bigint;
    approveIfNeeded?: boolean;
  }) =>
    ({
      kind: ItemKind.ERC20Transfer,
      token: p.token,
      to: p.to,
      amount: p.amount,
      approveIfNeeded: p.approveIfNeeded,
      ...(p.indirect && {
        _indirect: true,
        _bridgeMsgValue: p.bridgeMsgValue ?? 0n,
      }),
    }) as const satisfies BundleItem,

  /** Plain remote call */
  remoteCall: (p: { to: `0x${string}`; data: `0x${string}`; value?: bigint }) =>
    ({ kind: ItemKind.RemoteCall, ...p }) as const satisfies BundleItem,
} as const;
