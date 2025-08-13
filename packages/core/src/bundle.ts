import type { BundleItem } from './types';
import { ItemKind } from './types';

/**
 * Factory helpers to construct bundle items.
 *
 * @remarks
 * These constructors are shape-only: they do not encode attributes or
 * perform chain logic. The transport layer (e.g., `toCallStarter`) maps
 * them to InteropCallStarters and attaches the right attributes.
 */
export const bundle = {
  /**
   * Native token transfer to a destination address.
   *
   * @param p
   * @param p.to     Recipient address on the destination chain.
   * @param p.amount Amount in wei.
   * @returns        {@link BundleItem} of kind `NativeTransfer`.
   *
   * @example
   * bundle.native({ to: '0xabc…', amount: 1_000_000_000n });
   */
  native: (p: { to: `0x${string}`; amount: bigint }) =>
    ({ kind: ItemKind.NativeTransfer, ...p }) as const satisfies BundleItem,

  /**
   * ERC-20 transfer; either direct (remote `transfer`) or indirect (bridge).
   *
   * @param p
   * @param p.token            ERC-20 token address on the source chain.
   * @param p.to               Recipient address on the destination chain.
   * @param p.amount           Token amount (base units).
   * @param p.indirect         If true, use bridging path via AssetRouter/NTV.
   * @param p.bridgeMsgValue   ETH to send with the indirect bridge message (wei).
   * @param p.approveIfNeeded  Hint used by higher-level helpers to approve NTV.
   * @returns                  {@link BundleItem} of kind `ERC20Transfer`.
   *
   * @remarks
   * - **Direct**: encodes a remote call to `token.transfer(to, amount)` on dest.
   * - **Indirect**: burns/deposits on src, mints/withdraws on dest. `bridgeMsgValue`
   *   funds the IL2CrossChainSender hop; `approveIfNeeded` is consumed by helpers.
   */
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

  /**
   * Plain remote call to a destination contract.
   *
   * @param p
   * @param p.to    Target contract address on the destination chain.
   * @param p.data  ABI-encoded calldata.
   * @param p.value Optional value in wei (forwarded as interop call value).
   * @returns       {@link BundleItem} of kind `RemoteCall`.
   *
   * @example
   * bundle.remoteCall({ to, data: iface.encodeFunctionData('foo', [42n]) });
   */
  remoteCall: (p: { to: `0x${string}`; data: `0x${string}`; value?: bigint }) =>
    ({ kind: ItemKind.RemoteCall, ...p }) as const satisfies BundleItem,
} as const;
