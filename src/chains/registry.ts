import type { ChainInfo, ChainRegistryInit } from './types';
import type { ChainRef } from '../types/primitives';

function byKeyOrId(a: ChainInfo, b: ChainInfo): boolean {
  return a.key === b.key || a.chainId === b.chainId;
}

export class ChainRegistry {
  private readonly items: ChainInfo[];

  constructor(args?: ChainRegistryInit) {
    const base = (args?.builtins ?? []).slice();
    const ovrs = args?.overrides ?? [];
    for (const o of ovrs) {
      const ix = base.findIndex((x) => byKeyOrId(x, o));
      if (ix >= 0) base[ix] = o;
      else base.push(o);
    }
    this.items = base;
  }

  list(): readonly ChainInfo[] {
    return this.items.slice();
  }

  /** Resolve by semantic key or chainId. Throws if not found. */
  resolve(ref: ChainRef): ChainInfo {
    const out =
      typeof ref === 'number'
        ? this.items.find((x) => x.chainId === ref)
        : this.items.find((x) => x.key.toLowerCase() === String(ref).toLowerCase());

    if (!out) {
      throw Object.assign(new Error(`Chain not found in registry: ${String(ref)}`), {
        code: 'CONFIG',
        kind: 'Config',
      });
    }
    return out;
  }
}

/** Default builtins — safe placeholders for now. Override in client init as needed. */
export const defaultRegistry = new ChainRegistry({
  builtins: [
    {
      key: 'local',
      name: 'Local ZKsync OS',
      chainId: 260, // common local value; adjust in overrides
      addresses: {
        l1: {
          bridgehub: '0x0000000000000000000000000000000000000001',
          assetRouter: '0x0000000000000000000000000000000000000002',
          nativeTokenVault: '0x0000000000000000000000000000000000000003',
        },
        l2: {
          interopCenter: '0x0000000000000000000000000000000000000004',
          handler: '0x0000000000000000000000000000000000000005',
          assetRouter: '0x0000000000000000000000000000000000000006',
          nativeTokenVault: '0x0000000000000000000000000000000000000007',
        },
      },
      gas: { minGasLimit: 300_000n, gasBufferPct: 15 },
    },
    {
      key: 'era-test',
      name: 'ZKsync OS Testnet (example)',
      chainId: 300, // placeholder; override with real
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
    },
  ],
});
