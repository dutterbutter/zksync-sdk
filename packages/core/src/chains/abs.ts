import type { ChainInfo } from '../types';

/** Abstract mainnet (chainId 2741) */
export const abs: ChainInfo = {
  key: 'abs',
  name: 'Abstract',
  chainId: 2741,
  rpcUrls: ['https://api.mainnet.abs.xyz/'],
  explorer: { baseUrl: 'https://abscan.org/' },
  addresses: {
    interopCenter: '0x000000000000000000000000000000000001000b',
    handler: '0x000000000000000000000000000000000001000c',
    assetRouter: '0x0000000000000000000000000000000000001003',
    nativeTokenVault: '0x0000000000000000000000000000000000001004',
  },
  gas: { gasBufferPct: 30, minGasLimit: 120_000n },
};

/** Abstract testnet (chainId 11124) */
export const abs_testnet: ChainInfo = {
  key: 'abs-testnet',
  name: 'Abstract Testnet',
  chainId: 11124,
  rpcUrls: ['https://api.testnet.abs.xyz'],
  explorer: { baseUrl: 'https://sepolia.abscan.org/' },
  addresses: {
    interopCenter: '0x000000000000000000000000000000000001000b',
    handler: '0x000000000000000000000000000000000001000c',
    assetRouter: '0x0000000000000000000000000000000000010003',
    nativeTokenVault: '0x0000000000000000000000000000000000010004',
  },
  gas: { gasBufferPct: 30, minGasLimit: 120_000n },
};
