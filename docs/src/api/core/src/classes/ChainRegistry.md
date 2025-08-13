[**zksync-sdk-monorepo**](../../../README.md)

***

[zksync-sdk-monorepo](../../../README.md) / [core/src](../README.md) / ChainRegistry

# Class: ChainRegistry

Defined in: [packages/core/src/chains/registry.ts:6](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/chains/registry.ts#L6)

## Constructors

### Constructor

> **new ChainRegistry**(`init?`): `ChainRegistry`

Defined in: [packages/core/src/chains/registry.ts:11](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/chains/registry.ts#L11)

#### Parameters

##### init?

[`ChainRegistryInit`](../interfaces/ChainRegistryInit.md)

#### Returns

`ChainRegistry`

## Methods

### add()

> **add**(`info`, `override`): `void`

Defined in: [packages/core/src/chains/registry.ts:18](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/chains/registry.ts#L18)

#### Parameters

##### info

[`ChainInfo`](../interfaces/ChainInfo.md)

##### override

`boolean` = `true`

#### Returns

`void`

***

### resolve()

> **resolve**(`keyOrAlias`): [`ChainInfo`](../interfaces/ChainInfo.md)

Defined in: [packages/core/src/chains/registry.ts:40](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/chains/registry.ts#L40)

resolve only by key / alias string

#### Parameters

##### keyOrAlias

`string`

#### Returns

[`ChainInfo`](../interfaces/ChainInfo.md)

***

### resolveRef()

> **resolveRef**(`ref`): [`ChainInfo`](../interfaces/ChainInfo.md)

Defined in: [packages/core/src/chains/registry.ts:31](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/chains/registry.ts#L31)

resolve semantic key, alias or numeric chainId

#### Parameters

##### ref

[`ChainRef`](../type-aliases/ChainRef.md)

#### Returns

[`ChainInfo`](../interfaces/ChainInfo.md)
