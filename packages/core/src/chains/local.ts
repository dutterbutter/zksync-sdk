import type { ChainInfo } from '../types';

/** Anvil local development network (chainId 31337) */
export const localAnvil: ChainInfo = {
  key: 'local-anvil',
  name: 'Local Anvil',
  chainId: 31337,
  rpcUrls: ['http://localhost:8545'],
  explorer: { baseUrl: 'http://localhost:3000' },
  addresses: {
    interopCenter: '0x1111111111111111111111111111111111111111',
    handler:       '0x2222222222222222222222222222222222222222',
  },
  gas: { gasBufferPct: 30, minGasLimit: 120_000n },
};
