[**zksync-sdk-monorepo**](../../../README.md)

***

[zksync-sdk-monorepo](../../../README.md) / [core/src](../README.md) / bundle

# Variable: bundle

> `const` **bundle**: `object`

Defined in: [packages/core/src/bundle.ts:12](https://github.com/dutterbutter/zksync-sdk/blob/128d557933eb10f01edd78c0b3392137ca480daf/packages/core/src/bundle.ts#L12)

Factory helpers to construct bundle items.

## Type declaration

### erc20()

> `readonly` **erc20**: (`p`) => `object`

ERC-20 transfer; either direct (remote `transfer`) or indirect (bridge).

#### Parameters

##### p

###### amount

`bigint`

Token amount (base units).

###### approveIfNeeded?

`boolean`

Hint used by higher-level helpers to approve NTV.

###### bridgeMsgValue?

`bigint`

ETH to send with the indirect bridge message (wei).

###### indirect?

`boolean`

If true, use bridging path via AssetRouter/NTV.

###### to

`` `0x${string}` ``

Recipient address on the destination chain.

###### token

`` `0x${string}` ``

ERC-20 token address on the source chain.

#### Returns

`object`

[BundleItem](../type-aliases/BundleItem.md) of kind `ERC20Transfer`.

##### \_bridgeMsgValue?

> `readonly` `optional` **\_bridgeMsgValue**: `bigint`

##### \_indirect?

> `readonly` `optional` **\_indirect**: `true` = `true`

##### amount

> `readonly` **amount**: `bigint` = `p.amount`

##### approveIfNeeded

> `readonly` **approveIfNeeded**: `undefined` \| `boolean` = `p.approveIfNeeded`

##### kind

> `readonly` **kind**: `"erc20Transfer"` = `ItemKind.ERC20Transfer`

##### to

> `readonly` **to**: `` `0x${string}` `` = `p.to`

##### token

> `readonly` **token**: `` `0x${string}` `` = `p.token`

#### Remarks

- **Direct**: encodes a remote call to `token.transfer(to, amount)` on dest.
- **Indirect**: burns/deposits on src, mints/withdraws on dest. `bridgeMsgValue`
  funds the IL2CrossChainSender hop; `approveIfNeeded` is consumed by helpers.

### native()

> `readonly` **native**: (`p`) => `object`

Native token transfer to a destination address.

#### Parameters

##### p

###### amount

`bigint`

Amount in wei.

###### to

`` `0x${string}` ``

Recipient address on the destination chain.

#### Returns

`object`

[BundleItem](../type-aliases/BundleItem.md) of kind `NativeTransfer`.

##### amount

> `readonly` **amount**: `bigint`

##### kind

> `readonly` **kind**: `"nativeTransfer"` = `ItemKind.NativeTransfer`

##### to

> `readonly` **to**: `` `0x${string}` ``

#### Example

```ts
bundle.native({ to: '0xabc…', amount: 1_000_000_000n });
```

### remoteCall()

> `readonly` **remoteCall**: (`p`) => `object`

Plain remote call to a destination contract.

#### Parameters

##### p

###### data

`` `0x${string}` ``

ABI-encoded calldata.

###### to

`` `0x${string}` ``

Target contract address on the destination chain.

###### value?

`bigint`

Optional value in wei (forwarded as interop call value).

#### Returns

`object`

[BundleItem](../type-aliases/BundleItem.md) of kind `RemoteCall`.

##### data

> `readonly` **data**: `` `0x${string}` ``

##### kind

> `readonly` **kind**: `"remoteCall"` = `ItemKind.RemoteCall`

##### to

> `readonly` **to**: `` `0x${string}` ``

##### value?

> `readonly` `optional` **value**: `bigint`

#### Example

```ts
bundle.remoteCall({ to, data: iface.encodeFunctionData('foo', [42n]) });
```

## Remarks

These constructors are shape-only: they do not encode attributes or
perform chain logic. The transport layer (e.g., `toCallStarter`) maps
them to InteropCallStarters and attaches the right attributes.
