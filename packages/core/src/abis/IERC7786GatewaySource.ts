import type { JsonAbi } from '../types';

export const IERC7786GatewaySourceAbi: JsonAbi = [
  {
    type: 'function',
    name: 'sendMessage',
    inputs: [
      {
        name: 'recipient',
        type: 'bytes',
        internalType: 'bytes',
      },
      {
        name: 'payload',
        type: 'bytes',
        internalType: 'bytes',
      },
      {
        name: 'attributes',
        type: 'bytes[]',
        internalType: 'bytes[]',
      },
    ],
    outputs: [
      {
        name: 'sendId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'supportsAttribute',
    inputs: [
      {
        name: 'selector',
        type: 'bytes4',
        internalType: 'bytes4',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'MessageSent',
    inputs: [
      {
        name: 'sendId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'sender',
        type: 'bytes',
        indexed: false,
        internalType: 'bytes',
      },
      {
        name: 'recipient',
        type: 'bytes',
        indexed: false,
        internalType: 'bytes',
      },
      {
        name: 'payload',
        type: 'bytes',
        indexed: false,
        internalType: 'bytes',
      },
      {
        name: 'value',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'attributes',
        type: 'bytes[]',
        indexed: false,
        internalType: 'bytes[]',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'UnsupportedAttribute',
    inputs: [
      {
        name: 'selector',
        type: 'bytes4',
        internalType: 'bytes4',
      },
    ],
  },
] as const;
export type IERC7786GatewaySourceAbi = typeof IERC7786GatewaySourceAbi;
