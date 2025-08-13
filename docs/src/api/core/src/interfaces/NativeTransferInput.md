[**zksync-sdk-monorepo**](../../../README.md)

***

[zksync-sdk-monorepo](../../../README.md) / [core/src](../README.md) / NativeTransferInput

# Interface: NativeTransferInput

Defined in: [packages/core/src/types.ts:65](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L65)

## Extends

- [`MessageOptions`](MessageOptions.md)

## Properties

### amount

> **amount**: `bigint`

Defined in: [packages/core/src/types.ts:67](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L67)

***

### attributes?

> `optional` **attributes**: [`ERC7786Attribute`](../type-aliases/ERC7786Attribute.md)[]

Defined in: [packages/core/src/types.ts:45](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L45)

#### Inherited from

[`MessageOptions`](MessageOptions.md).[`attributes`](MessageOptions.md#attributes)

***

### clientTag?

> `optional` **clientTag**: `string`

Defined in: [packages/core/src/types.ts:54](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L54)

#### Inherited from

[`MessageOptions`](MessageOptions.md).[`clientTag`](MessageOptions.md#clienttag)

***

### deadline?

> `optional` **deadline**: `number`

Defined in: [packages/core/src/types.ts:55](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L55)

#### Inherited from

[`MessageOptions`](MessageOptions.md).[`deadline`](MessageOptions.md#deadline)

***

### dest?

> `optional` **dest**: [`ChainRef`](../type-aliases/ChainRef.md)

Defined in: [packages/core/src/types.ts:44](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L44)

#### Inherited from

[`MessageOptions`](MessageOptions.md).[`dest`](MessageOptions.md#dest)

***

### gas?

> `optional` **gas**: `Partial`\<\{ `gasBufferPct`: `number`; `gasLimit`: `bigint`; `maxFeePerGas`: `bigint`; `maxPriorityFeePerGas`: `bigint`; \}\>

Defined in: [packages/core/src/types.ts:46](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L46)

#### Inherited from

[`MessageOptions`](MessageOptions.md).[`gas`](MessageOptions.md#gas)

***

### nonce?

> `optional` **nonce**: `bigint`

Defined in: [packages/core/src/types.ts:52](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L52)

#### Inherited from

[`MessageOptions`](MessageOptions.md).[`nonce`](MessageOptions.md#nonce)

***

### note?

> `optional` **note**: `string`

Defined in: [packages/core/src/types.ts:53](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L53)

#### Inherited from

[`MessageOptions`](MessageOptions.md).[`note`](MessageOptions.md#note)

***

### signal?

> `optional` **signal**: `AbortSignal`

Defined in: [packages/core/src/types.ts:56](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L56)

#### Inherited from

[`MessageOptions`](MessageOptions.md).[`signal`](MessageOptions.md#signal)

***

### src?

> `optional` **src**: [`ChainRef`](../type-aliases/ChainRef.md)

Defined in: [packages/core/src/types.ts:43](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L43)

#### Inherited from

[`MessageOptions`](MessageOptions.md).[`src`](MessageOptions.md#src)

***

### to

> **to**: `` `0x${string}` ``

Defined in: [packages/core/src/types.ts:66](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L66)
