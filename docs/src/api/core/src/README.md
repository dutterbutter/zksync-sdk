[**zksync-sdk-monorepo**](../../README.md)

***

[zksync-sdk-monorepo](../../README.md) / core/src

# core/src

Public API for @zksync-sdk/core

## Classes

- [ChainRegistry](classes/ChainRegistry.md)
- [InteropError](classes/InteropError.md)

## Interfaces

- [BuiltTx](interfaces/BuiltTx.md)
- [BundleInput](interfaces/BundleInput.md)
- [BundleReceipt](interfaces/BundleReceipt.md)
- [ChainInfo](interfaces/ChainInfo.md)
- [ChainRegistryInit](interfaces/ChainRegistryInit.md)
- [ERC20TransferInput](interfaces/ERC20TransferInput.md)
- [MessageOptions](interfaces/MessageOptions.md)
- [MessageReceipt](interfaces/MessageReceipt.md)
- [MessageStatus](interfaces/MessageStatus.md)
- [NativeTransferInput](interfaces/NativeTransferInput.md)
- [RemoteCallInput](interfaces/RemoteCallInput.md)
- [SentMessage](interfaces/SentMessage.md)

## Type Aliases

- [BundleAtomicity](type-aliases/BundleAtomicity.md)
- [BundleItem](type-aliases/BundleItem.md)
- [ChainKey](type-aliases/ChainKey.md)
- [ChainRef](type-aliases/ChainRef.md)
- [ERC7786Attribute](type-aliases/ERC7786Attribute.md)
- [Hex](type-aliases/Hex.md)
- [IERC7786GatewaySourceAbi](type-aliases/IERC7786GatewaySourceAbi.md)
- [IInteropCenterAbi](type-aliases/IInteropCenterAbi.md)
- [IInteropHandlerAbi](type-aliases/IInteropHandlerAbi.md)
- [InteropErrorCode](type-aliases/InteropErrorCode.md)
- [InteropErrorDetails](type-aliases/InteropErrorDetails.md)
- [ItemKind](type-aliases/ItemKind.md)
- [JsonAbi](type-aliases/JsonAbi.md)
- [JsonAbiItem](type-aliases/JsonAbiItem.md)
- [JsonAbiParam](type-aliases/JsonAbiParam.md)
- [MessagePhase](type-aliases/MessagePhase.md)

## Variables

- [ATTR](variables/ATTR.md)
- [builtinChains](variables/builtinChains.md)
- [bundle](variables/bundle.md)
- [Chains](variables/Chains.md)
- [defaultRegistry](variables/defaultRegistry.md)
- [IERC7786GatewaySourceAbi](variables/IERC7786GatewaySourceAbi.md)
- [IInteropCenterAbi](variables/IInteropCenterAbi.md)
- [IInteropHandlerAbi](variables/IInteropHandlerAbi.md)
- [ItemKind](variables/ItemKind.md)

## Functions

- [computeBundleMessageValue](functions/computeBundleMessageValue.md)
- [encodeEvmV1](functions/encodeEvmV1.md)
- [encodeEvmV1AddressOnly](functions/encodeEvmV1AddressOnly.md)
- [encodeEvmV1ChainOnly](functions/encodeEvmV1ChainOnly.md)
- [interopErrorFromRevertData](functions/interopErrorFromRevertData.md)
- [mergeAttributes](functions/mergeAttributes.md)
- [parseBundleHashFromLogs](functions/parseBundleHashFromLogs.md)
- [parseRevertData](functions/parseRevertData.md)
- [parseSendIdFromLogs](functions/parseSendIdFromLogs.md)
- [toCallStarter](functions/toCallStarter.md)

## References

### ERC7786GatewaySourceAbi

Renames and re-exports [IERC7786GatewaySourceAbi](variables/IERC7786GatewaySourceAbi.md)

***

### ERC7786GatewaySourceAbiType

Renames and re-exports [IERC7786GatewaySourceAbi](variables/IERC7786GatewaySourceAbi.md)

***

### InteropCenterAbi

Renames and re-exports [IInteropCenterAbi](variables/IInteropCenterAbi.md)

***

### InteropCenterAbiType

Renames and re-exports [IInteropCenterAbi](variables/IInteropCenterAbi.md)

***

### InteropHandlerAbi

Renames and re-exports [IInteropHandlerAbi](variables/IInteropHandlerAbi.md)

***

### InteropHandlerAbiType

Renames and re-exports [IInteropHandlerAbi](variables/IInteropHandlerAbi.md)
