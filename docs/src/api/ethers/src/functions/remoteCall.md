[**zksync-sdk-monorepo**](../../../README.md)

***

[zksync-sdk-monorepo](../../../README.md) / [ethers/src](../README.md) / remoteCall

# Function: remoteCall()

> **remoteCall**(`signer`, `input`): `Promise`\<`SentMessage`\>

Defined in: [packages/ethers/src/actions/remoteCall.ts:39](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/ethers/src/actions/remoteCall.ts#L39)

Perform a single cross-chain call using `InteropCenter.sendMessage` (no bundling).

## Parameters

### signer

`Signer`

Signer bound to the source chain provider.

### input

`RemoteCallInput` & `object`

## Returns

`Promise`\<`SentMessage`\>

SentMessage containing `sendId` and `srcTxHash`.

## Throws

If signer has no provider or send fails.

## Remarks

- Recipient is encoded as ERC-7930 EVM (chain + address).
- Base-token rules apply to `msg.value`: SAME base → `value`; DIFFERENT → `0`.
