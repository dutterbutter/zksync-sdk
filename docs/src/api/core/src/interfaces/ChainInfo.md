[**zksync-sdk-monorepo**](../../../README.md)

---

[zksync-sdk-monorepo](../../../README.md) / [core/src](../README.md) / ChainInfo

# Interface: ChainInfo

Defined in: [packages/core/src/types.ts:13](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L13)

## Properties

### addresses

> **addresses**: `object`

Defined in: [packages/core/src/types.ts:19](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L19)

#### assetRouter?

> `optional` **assetRouter**: `` `0x${string}` ``

#### bridgehub?

> `optional` **bridgehub**: `` `0x${string}` ``

#### handler

> **handler**: `` `0x${string}` ``

#### interopCenter

> **interopCenter**: `` `0x${string}` ``

#### nativeTokenVault?

> `optional` **nativeTokenVault**: `` `0x${string}` ``

---

### aliases?

> `optional` **aliases**: `string`[]

Defined in: [packages/core/src/types.ts:29](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L29)

---

### chainId

> **chainId**: `number`

Defined in: [packages/core/src/types.ts:16](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L16)

---

### explorer?

> `optional` **explorer**: `object`

Defined in: [packages/core/src/types.ts:18](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L18)

#### baseUrl

> **baseUrl**: `string`

---

### finalization?

> `optional` **finalization**: `object`

Defined in: [packages/core/src/types.ts:27](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L27)

#### pollIntervalMs?

> `optional` **pollIntervalMs**: `number`

#### timeoutMs?

> `optional` **timeoutMs**: `number`

---

### gas?

> `optional` **gas**: `object`

Defined in: [packages/core/src/types.ts:28](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L28)

#### gasBufferPct?

> `optional` **gasBufferPct**: `number`

#### minGasLimit?

> `optional` **minGasLimit**: `bigint`

---

### key

> **key**: [`ChainKey`](../type-aliases/ChainKey.md)

Defined in: [packages/core/src/types.ts:14](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L14)

---

### name

> **name**: `string`

Defined in: [packages/core/src/types.ts:15](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L15)

---

### rpcUrls

> **rpcUrls**: `string`[]

Defined in: [packages/core/src/types.ts:17](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L17)

---

### tokens?

> `optional` **tokens**: `object`[]

Defined in: [packages/core/src/types.ts:26](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L26)

#### address

> **address**: `` `0x${string}` ``

#### alias?

> `optional` **alias**: `string`[]

#### decimals

> **decimals**: `number`

#### symbol

> **symbol**: `string`

---

### version?

> `optional` **version**: `string`

Defined in: [packages/core/src/types.ts:30](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L30)
