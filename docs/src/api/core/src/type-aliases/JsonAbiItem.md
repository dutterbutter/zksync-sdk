[**zksync-sdk-monorepo**](../../../README.md)

***

[zksync-sdk-monorepo](../../../README.md) / [core/src](../README.md) / JsonAbiItem

# Type Alias: JsonAbiItem

> **JsonAbiItem** = `Readonly`\<\{ `inputs?`: readonly [`JsonAbiParam`](JsonAbiParam.md)[]; `name`: `string`; `outputs?`: readonly [`JsonAbiParam`](JsonAbiParam.md)[]; `stateMutability?`: `"pure"` \| `"view"` \| `"nonpayable"` \| `"payable"`; `type`: `"function"`; \}\> \| `Readonly`\<\{ `anonymous?`: `boolean`; `inputs?`: readonly [`JsonAbiParam`](JsonAbiParam.md)[]; `name`: `string`; `type`: `"event"`; \}\> \| `Readonly`\<\{ `inputs?`: readonly [`JsonAbiParam`](JsonAbiParam.md)[]; `stateMutability?`: `"nonpayable"` \| `"payable"`; `type`: `"constructor"`; \}\> \| `Readonly`\<\{ `inputs?`: readonly [`JsonAbiParam`](JsonAbiParam.md)[]; `name`: `string`; `type`: `"error"`; \}\> \| `Readonly`\<\{ `type`: `"fallback"` \| `"receive"`; \}\>

Defined in: [packages/core/src/types.ts:202](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/types.ts#L202)
