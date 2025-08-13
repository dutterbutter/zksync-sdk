[**zksync-sdk-monorepo**](../../../README.md)

***

[zksync-sdk-monorepo](../../../README.md) / [core/src](../README.md) / mergeAttributes

# Function: mergeAttributes()

> **mergeAttributes**(`base`, `extra`): `` `0x${string}` ``[]

Defined in: [packages/core/src/utils.ts:88](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/utils.ts#L88)

Merge user-provided structured attributes with extra pre-encoded attributes.

## Parameters

### base

Optional structured attributes (objects with `.data` hex).

`undefined` | [`ERC7786Attribute`](../type-aliases/ERC7786Attribute.md)[]

### extra

`` `0x${string}` ``[]

Additional already-encoded attribute bytes.

## Returns

`` `0x${string}` ``[]

Flat array of encoded attribute hex strings; order is `base` then `extra`.

## Remarks

This does not de-dupe or validate semantics; the contract enforces attribute rules.
