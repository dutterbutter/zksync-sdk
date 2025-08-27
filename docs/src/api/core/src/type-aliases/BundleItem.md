[**zksync-sdk-monorepo**](../../../README.md)

---

[zksync-sdk-monorepo](../../../README.md) / [core/src](../README.md) / BundleItem

# Type Alias: BundleItem

> **BundleItem** = \{ `data`: `` `0x${string}` ``; `kind`: _typeof_ [`RemoteCall`](../variables/ItemKind.md#remotecall); `to`: `` `0x${string}` ``; `value?`: `bigint`; \} \| \{ `amount`: `bigint`; `kind`: _typeof_ [`NativeTransfer`](../variables/ItemKind.md#nativetransfer); `to`: `` `0x${string}` ``; \} \| \{ `_bridgeMsgValue?`: `bigint`; `_indirect?`: `true`; `amount`: `bigint`; `approveIfNeeded?`: `boolean`; `kind`: _typeof_ [`ERC20Transfer`](../variables/ItemKind.md#erc20transfer); `to`: `` `0x${string}` ``; `token`: `` `0x${string}` ``; \}

Defined in: [packages/core/src/types.ts:89](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L89)
