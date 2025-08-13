[**zksync-sdk-monorepo**](../../../README.md)

***

[zksync-sdk-monorepo](../../../README.md) / [core/src](../README.md) / encodeEvmV1ChainOnly

# Function: encodeEvmV1ChainOnly()

> **encodeEvmV1ChainOnly**(`chainId`): `` `0x${string}` ``

Defined in: [packages/core/src/encoding/7930.ts:59](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/encoding/7930.ts#L59)

Encode a **chain-only** ERC-7930 address (destination for `sendBundle`).

## Parameters

### chainId

EIP-155 chain id.

`number` | `bigint`

## Returns

`` `0x${string}` ``

Chain-only interoperable address.
