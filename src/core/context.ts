import type { ReadProvider, BackoffConfig } from './interfaces';
import type { ChainInfo } from '../chains/types';
import { ChainRegistry, defaultRegistry } from '../chains/registry';

export interface CoreInit {
  l1: ReadProvider;
  l2: ReadProvider;
  registryOverrides?: ChainInfo[];
  backoff?: BackoffConfig;
}

/** CoreContext is held by clients (ethers/viem). */
export class CoreContext {
  readonly l1: ReadProvider;
  readonly l2: ReadProvider;
  readonly registry: ChainRegistry;
  readonly backoff: Required<BackoffConfig>;

  constructor(init: CoreInit) {
    this.l1 = init.l1;
    this.l2 = init.l2;
    this.registry = new ChainRegistry({
      builtins: [...defaultRegistry.list()],
      overrides: init.registryOverrides,
    });
    this.backoff = {
      base: init.backoff?.base ?? 500,
      factor: init.backoff?.factor ?? 1.5,
      jitter: init.backoff?.jitter ?? 0.2,
      cap: init.backoff?.cap ?? 15_000,
    };
  }

  /** Shortcut to resolve chain info by chainId or key. */
  resolveChain(ref: number | string): ChainInfo {
    return this.registry.resolve(ref);
  }
}
