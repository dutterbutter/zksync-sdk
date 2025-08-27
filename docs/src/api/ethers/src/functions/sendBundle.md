[**zksync-sdk-monorepo**](../../../README.md)

---

[zksync-sdk-monorepo](../../../README.md) / [ethers/src](../README.md) / sendBundle

# Function: sendBundle()

> **sendBundle**(`signer`, `input`): `Promise`\<`SentMessage`\>

Defined in: [packages/ethers/src/actions/sendBundle.ts:45](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/ethers/src/actions/sendBundle.ts#L45)

Send a multi-item interop bundle via InteropCenter.

## Parameters

### signer

`Signer`

Signer bound to the source chain provider.

### input

`BundleInput` & `object`

Bundle payload and optional registry/gas overrides.

## Returns

`Promise`\<`SentMessage`\>

SentMessage containing `sendId` and `srcTxHash`.

## Throws

If signer has no provider, misconfiguration, or send fails.

## Remarks

- Destination is encoded as ERC-7930 “chain-only” address; per-item `to` uses “address-only”.
- `msg.value` must follow base-token rules:
  SAME base token → sum of item values; DIFFERENT → 0 (InteropCenter deposits via AssetRouter).
  This implementation currently uses the sum; add a base-token check if heterogeneous pairs are common.
- `sendId` is read from ERC-7786 `MessageSent` logs; for single-item bundles we fall back to
  `keccak256(abi.encode(bundleHash, 0))` when logs are unavailable.
