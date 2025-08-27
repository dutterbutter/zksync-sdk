[**zksync-sdk-monorepo**](../../../README.md)

---

[zksync-sdk-monorepo](../../../README.md) / [core/src](../README.md) / toCallStarter

# Function: toCallStarter()

> **toCallStarter**(`item`, `opts?`): `object`

Defined in: [packages/core/src/utils.ts:25](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/utils.ts#L25)

Convert a [BundleItem](../type-aliases/BundleItem.md) into an Interop call starter.

Produces `{ to, data, callAttributes }` for the contracts, plus an optional `value`
that contributes to the outer `msg.value` of `sendBundle`.

## Parameters

### item

[`BundleItem`](../type-aliases/BundleItem.md)

Bundle item (native, erc20, or remote call).

### opts?

Optional options.

#### assetRouter?

`` `0x${string}` ``

Required for **indirect** ERC-20; address of the AssetRouter.

## Returns

`object`

Object containing the encoded starter and an optional `value` to be summed into `msg.value`.

### starter

> **starter**: `object`

#### starter.callAttributes

> **callAttributes**: `` `0x${string}` ``[]

#### starter.data

> **data**: `` `0x${string}` ``

#### starter.to

> **to**: `` `0x${string}` ``

### value?

> `optional` **value**: `bigint`

## Throws

If an indirect ERC-20 is requested without `opts.assetRouter`, or the kind is unsupported.

## Remarks

- Per-item `to` is encoded as **ERC-7930 address-only** (contracts require empty chainRef in bundles).
- Do **not** combine `ATTR.indirectCall` with `ATTR.interopCallValue` on the same call; the contracts
  derive/check the call value for the actual bridged call internally.
