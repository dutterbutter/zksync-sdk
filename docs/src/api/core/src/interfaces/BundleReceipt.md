[**zksync-sdk-monorepo**](../../../README.md)

***

[zksync-sdk-monorepo](../../../README.md) / [core/src](../README.md) / BundleReceipt

# Interface: BundleReceipt

Defined in: [packages/core/src/types.ts:132](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L132)

## Extends

- [`MessageReceipt`](MessageReceipt.md)

## Properties

### destTxHash?

> `optional` **destTxHash**: `` `0x${string}` ``

Defined in: [packages/core/src/types.ts:117](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L117)

#### Inherited from

[`MessageReceipt`](MessageReceipt.md).[`destTxHash`](MessageReceipt.md#desttxhash)

***

### lastUpdateTs

> **lastUpdateTs**: `number`

Defined in: [packages/core/src/types.ts:118](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L118)

#### Inherited from

[`MessageReceipt`](MessageReceipt.md).[`lastUpdateTs`](MessageReceipt.md#lastupdatets)

***

### perItem?

> `optional` **perItem**: `object`[]

Defined in: [packages/core/src/types.ts:133](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L133)

#### error?

> `optional` **error**: `string`

#### gasUsed?

> `optional` **gasUsed**: `bigint`

#### index

> **index**: `number`

#### success

> **success**: `boolean`

***

### phase

> **phase**: [`MessagePhase`](../type-aliases/MessagePhase.md)

Defined in: [packages/core/src/types.ts:115](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L115)

#### Inherited from

[`MessageReceipt`](MessageReceipt.md).[`phase`](MessageReceipt.md#phase)

***

### raw?

> `optional` **raw**: `object`

Defined in: [packages/core/src/types.ts:129](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L129)

#### destReceipt?

> `optional` **destReceipt**: `unknown`

#### srcLogs?

> `optional` **srcLogs**: `unknown`[]

#### Inherited from

[`MessageReceipt`](MessageReceipt.md).[`raw`](MessageReceipt.md#raw)

***

### sendId

> **sendId**: `` `0x${string}` ``

Defined in: [packages/core/src/types.ts:114](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L114)

#### Inherited from

[`MessageReceipt`](MessageReceipt.md).[`sendId`](MessageReceipt.md#sendid)

***

### srcTxHash?

> `optional` **srcTxHash**: `` `0x${string}` ``

Defined in: [packages/core/src/types.ts:116](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L116)

#### Inherited from

[`MessageReceipt`](MessageReceipt.md).[`srcTxHash`](MessageReceipt.md#srctxhash)

***

### timeline

> **timeline**: `object`[]

Defined in: [packages/core/src/types.ts:122](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L122)

#### at

> **at**: `number`

#### blockNumber?

> `optional` **blockNumber**: `number`

#### meta?

> `optional` **meta**: `Record`\<`string`, `unknown`\>

#### phase

> **phase**: [`MessagePhase`](../type-aliases/MessagePhase.md)

#### txHash?

> `optional` **txHash**: `` `0x${string}` ``

#### Inherited from

[`MessageReceipt`](MessageReceipt.md).[`timeline`](MessageReceipt.md#timeline)
