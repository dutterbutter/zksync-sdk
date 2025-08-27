export const IL1NativeTokenVaultAbi = [
  {
    type: 'function',
    name: 'ASSET_ROUTER',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IAssetRouterBase',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'L1_CHAIN_ID',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'L1_NULLIFIER',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IL1Nullifier',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'WETH_TOKEN',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'assetId',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'bridgeCheckCounterpartAddress',
    inputs: [
      {
        name: '_chainId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: '_assetId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: '_originalCaller',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_assetHandlerAddressOnCounterpart',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'bridgedTokens',
    inputs: [
      {
        name: 'index',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'bridgedTokensCount',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'calculateCreate2TokenAddress',
    inputs: [
      {
        name: '_originChainId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: '_originToken',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'chainBalance',
    inputs: [
      {
        name: '_chainId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: '_assetId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'ensureTokenIsRegistered',
    inputs: [
      {
        name: '_nativeToken',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getERC20Getters',
    inputs: [
      {
        name: '_token',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_originChainId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'originChainId',
    inputs: [
      {
        name: 'assetId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'registerEthToken',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'registerToken',
    inputs: [
      {
        name: '_l1Token',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'tokenAddress',
    inputs: [
      {
        name: 'assetId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'tryRegisterTokenFromBurnData',
    inputs: [
      {
        name: '_burnData',
        type: 'bytes',
        internalType: 'bytes',
      },
      {
        name: '_expectedAssetId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'BridgedTokenBeaconUpdated',
    inputs: [
      {
        name: 'bridgedTokenBeacon',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'bridgedTokenProxyBytecodeHash',
        type: 'bytes32',
        indexed: false,
        internalType: 'bytes32',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'TokenBeaconUpdated',
    inputs: [
      {
        name: 'l2TokenBeacon',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
] as const;
export type IL1NativeTokenVaultAbi = typeof IL1NativeTokenVaultAbi;
