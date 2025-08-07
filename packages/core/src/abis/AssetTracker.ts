export const AssetTrackerAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "_l1ChainId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_bridgeHub",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_nativeTokenVault",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_messageRoot",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "BRIDGE_HUB",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IBridgehub"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "L1_ASSET_TRACKER",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "L1_CHAIN_ID",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MESSAGE_ROOT",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IMessageRoot"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "NATIVE_TOKEN_VAULT",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract INativeTokenVault"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "acceptOwnership",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "assetMigrationNumber",
    "inputs": [
      {
        "name": "assetId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "migrationNumber",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "assetSettlementLayer",
    "inputs": [
      {
        "name": "assetId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "settlementLayer",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "chainBalance",
    "inputs": [
      {
        "name": "chainId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "assetId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "balance",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "confirmMigrationOnGateway",
    "inputs": [
      {
        "name": "_chainId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_assetId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "_amount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_isL1ToGateway",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "confirmMigrationOnL2",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_assetId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_migrationNumber",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getBalanceChange",
    "inputs": [
      {
        "name": "_chainId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "assetId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "handleChainBalanceDecrease",
    "inputs": [
      {
        "name": "_tokenOriginChainId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_chainId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_assetId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "_amount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "handleChainBalanceIncrease",
    "inputs": [
      {
        "name": "_chainId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_assetId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "_amount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "initialize",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "initiateGatewayToL1MigrationOnGateway",
    "inputs": [
      {
        "name": "_chainId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_assetId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "initiateL1ToGatewayMigrationOnL2",
    "inputs": [
      {
        "name": "_assetId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "isMinterChain",
    "inputs": [
      {
        "name": "chainId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "assetId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "isMinter",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "parseInteropBundle",
    "inputs": [
      {
        "name": "_bundleData",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [
      {
        "name": "interopBundle",
        "type": "tuple",
        "internalType": "struct InteropBundle",
        "components": [
          {
            "name": "version",
            "type": "bytes1",
            "internalType": "bytes1"
          },
          {
            "name": "destinationChainId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "interopBundleSalt",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "calls",
            "type": "tuple[]",
            "internalType": "struct InteropCall[]",
            "components": [
              {
                "name": "version",
                "type": "bytes1",
                "internalType": "bytes1"
              },
              {
                "name": "shadowAccount",
                "type": "bool",
                "internalType": "bool"
              },
              {
                "name": "to",
                "type": "address",
                "internalType": "address"
              },
              {
                "name": "from",
                "type": "address",
                "internalType": "address"
              },
              {
                "name": "value",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "data",
                "type": "bytes",
                "internalType": "bytes"
              }
            ]
          },
          {
            "name": "bundleAttributes",
            "type": "tuple",
            "internalType": "struct BundleAttributes",
            "components": [
              {
                "name": "executionAddress",
                "type": "address",
                "internalType": "address"
              },
              {
                "name": "unbundlerAddress",
                "type": "address",
                "internalType": "address"
              }
            ]
          }
        ]
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "parseInteropCall",
    "inputs": [
      {
        "name": "_callData",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [
      {
        "name": "fromChainId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "assetId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "transferData",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "parseTokenData",
    "inputs": [
      {
        "name": "_tokenData",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [
      {
        "name": "originChainId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "name",
        "type": "bytes",
        "internalType": "bytes"
      },
      {
        "name": "symbol",
        "type": "bytes",
        "internalType": "bytes"
      },
      {
        "name": "decimals",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "pendingOwner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "processLogsAndMessages",
    "inputs": [
      {
        "name": "_processLogsInputs",
        "type": "tuple",
        "internalType": "struct ProcessLogsInput",
        "components": [
          {
            "name": "logs",
            "type": "tuple[]",
            "internalType": "struct L2Log[]",
            "components": [
              {
                "name": "l2ShardId",
                "type": "uint8",
                "internalType": "uint8"
              },
              {
                "name": "isService",
                "type": "bool",
                "internalType": "bool"
              },
              {
                "name": "txNumberInBatch",
                "type": "uint16",
                "internalType": "uint16"
              },
              {
                "name": "sender",
                "type": "address",
                "internalType": "address"
              },
              {
                "name": "key",
                "type": "bytes32",
                "internalType": "bytes32"
              },
              {
                "name": "value",
                "type": "bytes32",
                "internalType": "bytes32"
              }
            ]
          },
          {
            "name": "messages",
            "type": "bytes[]",
            "internalType": "bytes[]"
          },
          {
            "name": "chainId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "batchNumber",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "chainBatchRoot",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "messageRoot",
            "type": "bytes32",
            "internalType": "bytes32"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "receiveMigrationOnL1",
    "inputs": [
      {
        "name": "_finalizeWithdrawalParams",
        "type": "tuple",
        "internalType": "struct FinalizeL1DepositParams",
        "components": [
          {
            "name": "chainId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "l2BatchNumber",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "l2MessageIndex",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "l2Sender",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "l2TxNumberInBatch",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "message",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "merkleProof",
            "type": "bytes32[]",
            "internalType": "bytes32[]"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "registerLegacyToken",
    "inputs": [
      {
        "name": "_assetId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "registerNewToken",
    "inputs": [
      {
        "name": "_assetId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "renounceOwnership",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "transferOwnership",
    "inputs": [
      {
        "name": "newOwner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "Initialized",
    "inputs": [
      {
        "name": "version",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OwnershipTransferStarted",
    "inputs": [
      {
        "name": "previousOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OwnershipTransferred",
    "inputs": [
      {
        "name": "previousOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "ChainIdNotRegistered",
    "inputs": [
      {
        "name": "chainId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "InsufficientChainBalanceAssetTracker",
    "inputs": [
      {
        "name": "chainId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "assetId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "InvalidAmount",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidAssetId",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidChainId",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidInteropCalldata",
    "inputs": [
      {
        "name": "",
        "type": "bytes4",
        "internalType": "bytes4"
      }
    ]
  },
  {
    "type": "error",
    "name": "InvalidMessage",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidProof",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidSender",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotMigratedChain",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ReconstructionMismatch",
    "inputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  },
  {
    "type": "error",
    "name": "Unauthorized",
    "inputs": [
      {
        "name": "caller",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "UnsupportedEncodingVersion",
    "inputs": []
  }
] as const;
export type AssetTrackerAbi = typeof AssetTrackerAbi;
