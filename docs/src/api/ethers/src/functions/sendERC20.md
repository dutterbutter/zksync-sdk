[**zksync-sdk-monorepo**](../../../README.md)

***

[zksync-sdk-monorepo](../../../README.md) / [ethers/src](../README.md) / sendERC20

# Function: sendERC20()

> **sendERC20**(`signer`, `input`): `Promise`\<`SentMessage`\>

Defined in: [packages/ethers/src/actions/transfers.ts:100](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/ethers/src/actions/transfers.ts#L100)

Send ERC-20 from `src` to `dest` as a single-item interop bundle.

## Parameters

### signer

`Signer`

Signer bound to the source chain provider.

### input

`ERC20TransferInput` & `object`

## Returns

`Promise`\<`SentMessage`\>

SentMessage containing `sendId` and `srcTxHash`.

## Throws

If signer has no provider, or NTV address is missing for indirect path.

## Remarks

- **Indirect**: ensures token registration in NTV and sufficient allowance before sending.
- Do **not** set interop call value for indirect; contracts derive/validate it internally.
- Base-token `msg.value` rules are enforced by `sendBundle` (see its notes).
