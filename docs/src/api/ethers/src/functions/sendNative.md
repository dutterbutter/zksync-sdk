[**zksync-sdk-monorepo**](../../../README.md)

---

[zksync-sdk-monorepo](../../../README.md) / [ethers/src](../README.md) / sendNative

# Function: sendNative()

> **sendNative**(`signer`, `input`): `Promise`\<`SentMessage`\>

Defined in: [packages/ethers/src/actions/transfers.ts:60](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/ethers/src/actions/transfers.ts#L60)

Send native ETH from `src` to `dest` as a single-item interop bundle.

## Parameters

### signer

`Signer`

Signer bound to the source chain provider.

### input

`NativeTransferInput` & `object`

## Returns

`Promise`\<`SentMessage`\>

SentMessage containing `sendId` and `srcTxHash`.

## Throws

If no provider is attached to the signer.

## Remarks

- Contracts require `msg.value == amount` when source/dest share the same base token,
  and `msg.value == 0` when they differ. This helper defers value handling to `sendBundle`.
