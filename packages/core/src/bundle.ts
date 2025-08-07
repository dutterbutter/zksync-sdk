import type { BundleItem } from './types';
import { ItemKind } from './types';

export const bundle = {
  /** ETH transfer */
  native: (p: { to: `0x${string}`; amount: bigint }) =>
    ({ kind: ItemKind.NativeTransfer, ...p } as const satisfies BundleItem),

  /** ERC-20 transfer */
  erc20: (
    p: {
      token:  `0x${string}`;
      to:     `0x${string}`;
      amount: bigint;
      approveIfNeeded?: boolean;
    },
  ) =>
    ({ kind: ItemKind.ERC20Transfer, ...p } satisfies BundleItem),

  /** Plain remote call */
  remoteCall: (p: { to: `0x${string}`; data: `0x${string}`; value?: bigint }) =>
    ({ kind: ItemKind.RemoteCall, ...p } as const satisfies BundleItem),

  /** Pre-signed permit */
  permit: (p: { token: `0x${string}`; permitData: `0x${string}` }) =>
    ({ kind: ItemKind.Permit, ...p } as const satisfies BundleItem),
} as const;
