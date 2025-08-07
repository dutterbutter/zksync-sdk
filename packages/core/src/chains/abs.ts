import type { ChainInfo } from '../types';

/** Abstract mainnet (chainId 2741) */
export const abs: ChainInfo = {
  key: 'abs',
  name: 'Abstract',
  chainId: 2741,
  rpcUrls: ['https://api.mainnet.abs.xyz/'],
  explorer: { baseUrl: 'https://abscan.org/' },
  addresses: {
    interopCenter: '0x1111111111111111111111111111111111111111',
    handler:       '0x2222222222222222222222222222222222222222',
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
    interopCenter: '0x1111111111111111111111111111111111111111',
    handler:       '0x2222222222222222222222222222222222222222',
  },
  gas: { gasBufferPct: 30, minGasLimit: 120_000n },
};