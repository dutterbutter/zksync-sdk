[**zksync-sdk-monorepo**](../../../README.md)

---

[zksync-sdk-monorepo](../../../README.md) / [core/src](../README.md) / MessageReceipt

# Interface: MessageReceipt

Defined in: [packages/core/src/types.ts:121](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L121)

## Extends

- [`MessageStatus`](MessageStatus.md)

## Extended by

- [`BundleReceipt`](BundleReceipt.md)

## Properties

### destTxHash?

> `optional` **destTxHash**: `` `0x${string}` ``

Defined in: [packages/core/src/types.ts:117](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L117)

#### Inherited from

[`MessageStatus`](MessageStatus.md).[`destTxHash`](MessageStatus.md#desttxhash)

---

### lastUpdateTs

> **lastUpdateTs**: `number`

Defined in: [packages/core/src/types.ts:118](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L118)

#### Inherited from

[`MessageStatus`](MessageStatus.md).[`lastUpdateTs`](MessageStatus.md#lastupdatets)

---

### phase

> **phase**: [`MessagePhase`](../type-aliases/MessagePhase.md)

Defined in: [packages/core/src/types.ts:115](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L115)

#### Inherited from

[`MessageStatus`](MessageStatus.md).[`phase`](MessageStatus.md#phase)

---

### raw?

> `optional` **raw**: `object`

Defined in: [packages/core/src/types.ts:129](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L129)

#### destReceipt?

> `optional` **destReceipt**: `unknown`

#### srcLogs?

> `optional` **srcLogs**: `unknown`[]

---

### sendId

> **sendId**: `` `0x${string}` ``

Defined in: [packages/core/src/types.ts:114](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L114)

#### Inherited from

[`MessageStatus`](MessageStatus.md).[`sendId`](MessageStatus.md#sendid)

---

### srcTxHash?

> `optional` **srcTxHash**: `` `0x${string}` ``

Defined in: [packages/core/src/types.ts:116](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L116)

#### Inherited from

[`MessageStatus`](MessageStatus.md).[`srcTxHash`](MessageStatus.md#srctxhash)

---

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
