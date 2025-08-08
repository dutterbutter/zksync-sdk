import type { ChainInfo } from '../types';

/** ZKsync Era mainnet (chainId 324) */
export const era: ChainInfo = {
  key: 'era',
  name: 'ZKsync Era',
  chainId: 324,
  rpcUrls: ['https://mainnet.era.zksync.io'],
  explorer: { baseUrl: 'https://explorer.zksync.io' },
  addresses: {
    interopCenter: '0x1111111111111111111111111111111111111111',
    handler: '0x2222222222222222222222222222222222222222',
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
    interopCenter: '0x1111111111111111111111111111111111111111',
    handler: '0x2222222222222222222222222222222222222222',
  },
  gas: { gasBufferPct: 30, minGasLimit: 120_000n },
};
