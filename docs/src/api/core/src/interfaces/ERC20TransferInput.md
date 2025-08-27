[**zksync-sdk-monorepo**](../../../README.md)

---

[zksync-sdk-monorepo](../../../README.md) / [core/src](../README.md) / ERC20TransferInput

# Interface: ERC20TransferInput

Defined in: [packages/core/src/types.ts:70](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L70)

## Extends

- [`MessageOptions`](MessageOptions.md)

## Properties

### amount

> **amount**: `bigint`

Defined in: [packages/core/src/types.ts:73](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L73)

---

### approveIfNeeded?

> `optional` **approveIfNeeded**: `boolean`

Defined in: [packages/core/src/types.ts:74](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L74)

---

### attributes?

> `optional` **attributes**: [`ERC7786Attribute`](../type-aliases/ERC7786Attribute.md)[]

Defined in: [packages/core/src/types.ts:45](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L45)

#### Inherited from

[`MessageOptions`](MessageOptions.md).[`attributes`](MessageOptions.md#attributes)

---

### bridgeMsgValue?

> `optional` **bridgeMsgValue**: `bigint`

Defined in: [packages/core/src/types.ts:76](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L76)

---

### clientTag?

> `optional` **clientTag**: `string`

Defined in: [packages/core/src/types.ts:54](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L54)

#### Inherited from

[`MessageOptions`](MessageOptions.md).[`clientTag`](MessageOptions.md#clienttag)

---

### deadline?

> `optional` **deadline**: `number`

Defined in: [packages/core/src/types.ts:55](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L55)

#### Inherited from

[`MessageOptions`](MessageOptions.md).[`deadline`](MessageOptions.md#deadline)

---

### dest?

> `optional` **dest**: [`ChainRef`](../type-aliases/ChainRef.md)

Defined in: [packages/core/src/types.ts:44](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L44)

#### Inherited from

[`MessageOptions`](MessageOptions.md).[`dest`](MessageOptions.md#dest)

---

### gas?

> `optional` **gas**: `Partial`\<\{ `gasBufferPct`: `number`; `gasLimit`: `bigint`; `maxFeePerGas`: `bigint`; `maxPriorityFeePerGas`: `bigint`; \}\>

Defined in: [packages/core/src/types.ts:46](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L46)

#### Inherited from

[`MessageOptions`](MessageOptions.md).[`gas`](MessageOptions.md#gas)

---

### indirect?

> `optional` **indirect**: `boolean`

Defined in: [packages/core/src/types.ts:75](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L75)

---

### nonce?

> `optional` **nonce**: `bigint`

Defined in: [packages/core/src/types.ts:52](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L52)

#### Inherited from

[`MessageOptions`](MessageOptions.md).[`nonce`](MessageOptions.md#nonce)

---

### note?

> `optional` **note**: `string`

Defined in: [packages/core/src/types.ts:53](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L53)

#### Inherited from

[`MessageOptions`](MessageOptions.md).[`note`](MessageOptions.md#note)

---

### signal?

> `optional` **signal**: `AbortSignal`

Defined in: [packages/core/src/types.ts:56](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L56)

#### Inherited from

[`MessageOptions`](MessageOptions.md).[`signal`](MessageOptions.md#signal)

---

### src?

> `optional` **src**: [`ChainRef`](../type-aliases/ChainRef.md)

Defined in: [packages/core/src/types.ts:43](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L43)

#### Inherited from

[`MessageOptions`](MessageOptions.md).[`src`](MessageOptions.md#src)

---

### to

> **to**: `` `0x${string}` ``

Defined in: [packages/core/src/types.ts:72](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L72)

---

### token

> **token**: `` `0x${string}` ``

Defined in: [packages/core/src/types.ts:71](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L71)
