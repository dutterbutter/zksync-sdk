import type { Address } from '../types/primitives';

export interface ChainInfo {
  key: string; // canonical semantic key (lowercase)
  name: string; // human display
  chainId: number; // L2 chain id

  rpcUrls?: string[];
  explorer?: { baseUrl: string };

  addresses: {
    // L1 contracts used when interacting with this L2
    l1?: {
      bridgehub?: Address;
      assetRouter?: Address;
      nativeTokenVault?: Address; // IL1NativeTokenVault if used
    };
    // L2 contracts on the target L2
    l2: {
      interopCenter: Address;
      handler: Address;
      assetRouter?: Address;
      nativeTokenVault?: Address; // IL2NativeTokenVault
    };
  };

  tokens?: Array<{ symbol: string; address: Address; decimals: number; alias?: string[] }>;
  gas?: { minGasLimit?: bigint; gasBufferPct?: number };
}

export interface ChainRegistryInit {
  builtins?: ChainInfo[];
  overrides?: ChainInfo[]; // replace/augment builtins by key OR chainId
}
