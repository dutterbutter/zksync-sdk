import type { ChainInfo } from '../types';

// Local chains from bootstrap script
// TODO: clean up
export const local_era: ChainInfo = {
  key: 'local_era',
  name: 'Local Era',
  chainId: 271,
  rpcUrls: ['http://localhost:3050'],
  explorer: { baseUrl: 'http://localhost:3000' },
  addresses: {
    interopCenter: '0x000000000000000000000000000000000001000b',
    handler: '0x000000000000000000000000000000000001000c',
    assetRouter: '0x0000000000000000000000000000000000010003',
    nativeTokenVault: '0x0000000000000000000000000000000000010004',
  },
  gas: { gasBufferPct: 30, minGasLimit: 120_000n },
};

export const local_val: ChainInfo = {
  key: 'local_val',
  name: 'Local Val',
  chainId: 260,
  rpcUrls: ['http://localhost:3070'],
  explorer: { baseUrl: 'http://localhost:3000' },
  addresses: {
    interopCenter: '0x000000000000000000000000000000000001000b',
    handler: '0x000000000000000000000000000000000001000c',
    assetRouter: '0x0000000000000000000000000000000000010003',
    nativeTokenVault: '0x0000000000000000000000000000000000010004',
  },
  gas: { gasBufferPct: 30, minGasLimit: 120_000n },
};

export const local_gateway: ChainInfo = {
  key: 'local_gateway',
  name: 'Local Gateway',
  chainId: 506,
  rpcUrls: ['http://localhost:3250'],
  explorer: { baseUrl: 'http://localhost:3000' },
  addresses: {
    interopCenter: '0x000000000000000000000000000000000001000b',
    handler: '0x000000000000000000000000000000000001000c',
    assetRouter: '0x0000000000000000000000000000000000010003',
    nativeTokenVault: '0x0000000000000000000000000000000000010004',
  },
  gas: { gasBufferPct: 30, minGasLimit: 120_000n },
};
