import type { ChainInfo } from './types';

/** Example placeholder entries. Replace via registry overrides when known. */
export const eraTest: ChainInfo = {
  key: 'era-test',
  name: 'ZKsync OS Testnet (example)',
  chainId: 300, // placeholder
  addresses: {
    l1: {
      bridgehub: '0x0000000000000000000000000000000000000011',
      assetRouter: '0x0000000000000000000000000000000000000012',
      nativeTokenVault: '0x0000000000000000000000000000000000000013',
    },
    l2: {
      interopCenter: '0x0000000000000000000000000000000000000014',
      handler: '0x0000000000000000000000000000000000000015',
      assetRouter: '0x0000000000000000000000000000000000000016',
      nativeTokenVault: '0x0000000000000000000000000000000000000017',
    },
  },
};
