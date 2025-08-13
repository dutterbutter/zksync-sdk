[**zksync-sdk-monorepo**](../../../README.md)

***

[zksync-sdk-monorepo](../../../README.md) / [core/src](../README.md) / ATTR

# Variable: ATTR

> `const` **ATTR**: `object`

Defined in: [packages/core/src/encoding/attributes.ts:20](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/encoding/attributes.ts#L20)

ERC-7786 attribute encoders used by InteropCenter/Handler.

## Type declaration

### executionAddress()

> `readonly` **executionAddress**: (`erc7930`) => `` `0x${string}` ``

Restrict who can execute the bundle on the destination.

#### Parameters

##### erc7930

`` `0x${string}` ``

ERC-7930 interoperable address (typically **address-only**).

#### Returns

`` `0x${string}` ``

ABI-encoded ERC-7786 attribute.

#### Remarks

Include in the **bundle attributes** array. Omit for permissionless execution.

### indirectCall()

> `readonly` **indirectCall**: (`bridgeMsgValue`) => `` `0x${string}` ``

Mark a call as **indirect** (bridging path) and include message value for the bridge hop.

#### Parameters

##### bridgeMsgValue

`bigint`

ETH sent with the IL2CrossChainSender message (wei).

#### Returns

`` `0x${string}` ``

ABI-encoded ERC-7786 attribute.

#### Remarks

- Use only for the **AssetRouter/NTV** call starter in an indirect ERC-20 transfer.
- Do **not** combine with `interopCallValue` for the same call; the contracts derive/check it.

### interopCallValue()

> `readonly` **interopCallValue**: (`value`) => `` `0x${string}` ``

Set the value (base token) forwarded to the destination call.

#### Parameters

##### value

`bigint`

Amount in wei.

#### Returns

`` `0x${string}` ``

ABI-encoded ERC-7786 attribute.

#### Remarks

Include in the **call attributes** array for the target item.

### unbundlerAddress()

> `readonly` **unbundlerAddress**: (`erc7930`) => `` `0x${string}` ``

Restrict who can unbundle/cancel individual calls on the destination.

#### Parameters

##### erc7930

`` `0x${string}` ``

ERC-7930 interoperable address (typically **address-only**).

#### Returns

`` `0x${string}` ``

ABI-encoded ERC-7786 attribute.

#### Remarks

Include in the **bundle attributes** array. Omit to default to the original sender.

## Remarks

- **Call-level**: [ATTR.interopCallValue](#interopcallvalue), [ATTR.indirectCall](#indirectcall).
- **Bundle-level**: [ATTR.executionAddress](#executionaddress), [ATTR.unbundlerAddress](#unbundleraddress).
- For 7930 parameters, prefer the helpers in `encoding/7930` to produce **chain-only**
  or **address-only** encodings as required by the contracts.
