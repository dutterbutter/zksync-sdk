import type { ChainInfo } from '../types';

/** ZKsync Era mainnet (chainId 324) */
export const era: ChainInfo = {
  key: 'era',
  name: 'ZKsync Era',
  chainId: 324,
  rpcUrls: ['https://mainnet.era.zksync.io'],
  explorer: { baseUrl: 'https://explorer.zksync.io' },
  addresses: {
    interopCenter: '0x000000000000000000000000000000000001000b',
    handler: '0x000000000000000000000000000000000001000c',
    assetRouter: '0x0000000000000000000000000000000000001003',
    nativeTokenVault: '0x0000000000000000000000000000000000001004',
  },
  gas: { gasBufferPct: 30, minGasLimit: 120_000n },
};

/** ZKsync Era testnet (chainId 300) */
export const era_testnet: ChainInfo = {
  key: 'era-testnet',
  name: 'ZKsync Sepolia Era',
  chainId: 300,
  rpcUrls: ['https://sepolia.era.zksync.io'],
  explorer: { baseUrl: 'https://explorer.zksync.io' },
  addresses: {
    interopCenter: '0x000000000000000000000000000000000001000b',
    handler: '0x000000000000000000000000000000000001000c',
    assetRouter: '0x0000000000000000000000000000000000010003',
    nativeTokenVault: '0x0000000000000000000000000000000000010004',
  },
  gas: { gasBufferPct: 30, minGasLimit: 120_000n },
};
