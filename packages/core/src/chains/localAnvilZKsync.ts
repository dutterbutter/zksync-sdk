import type { ChainInfo } from '../types';

/** Anvil local development network (chainId 31337) */
export const localAnvilZKsync: ChainInfo = {
  key: 'local-anvil-zksync',
  name: 'Local Anvil ZKsync',
  chainId: 260,
  rpcUrls: ['http://localhost:8011'],
  explorer: { baseUrl: 'http://localhost:3000' },
  addresses: {
    interopCenter: '0x1111111111111111111111111111111111111111',
    handler:       '0x2222222222222222222222222222222222222222',
  },
  gas: { gasBufferPct: 30, minGasLimit: 120_000n },
};
