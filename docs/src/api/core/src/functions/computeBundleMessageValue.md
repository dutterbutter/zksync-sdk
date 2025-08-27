[**zksync-sdk-monorepo**](../../../README.md)

---

[zksync-sdk-monorepo](../../../README.md) / [core/src](../README.md) / computeBundleMessageValue

# Function: computeBundleMessageValue()

> **computeBundleMessageValue**(`items`): `bigint`

Defined in: [packages/core/src/utils.ts:109](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/utils.ts#L109)

Compute the `msg.value` to send with a bundle on chains where the base token matches.

Sums the value-bearing contributions:

- `NativeTransfer.amount`
- `RemoteCall.value` (if present)
- `ERC20Transfer._bridgeMsgValue` (only for **indirect** transfers)

Direct ERC-20 transfers contribute **0**.

## Parameters

### items

[`BundleItem`](../type-aliases/BundleItem.md)[]

Bundle items to inspect.

## Returns

`bigint`

Total value as `bigint`.

## Remarks

When source/destination base tokens differ, **contracts require** `msg.value = 0`,
regardless of this total. The caller should zero the value in that case.
