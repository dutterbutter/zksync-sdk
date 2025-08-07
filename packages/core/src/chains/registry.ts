// packages/core/src/registry.ts
import { builtinChains } from '.';
import type { ChainInfo, ChainRef, ChainRegistryInit } from '../types';

export class ChainRegistry {
  private readonly byKey  = new Map<string, ChainInfo>();
  private readonly byId   = new Map<number, ChainInfo>();
  private readonly alias  = new Map<string, string>(); // alias -> key

  constructor(init?: ChainRegistryInit) {
    const base = [...builtinChains, ...(init?.builtins ?? [])];

    for (const c of base)   this.add(c, false);
    for (const o of init?.overrides ?? []) this.add(o, true);
  }

  /** add/override programmatically */
  add(info: ChainInfo, override = true): void {
    const k = info.key.toLowerCase();
    if (!override && this.byKey.has(k)) return; // skip duplicates unless override

    this.byKey.set(k, info);
    this.byId.set(info.chainId, info);

    // self-key and aliases map to canonical key
    this.alias.set(k, k);
    for (const a of info.aliases ?? []) this.alias.set(a.toLowerCase(), k);
  }

  /** resolve semantic key, alias or numeric chainId */
  resolveRef(ref: ChainRef): ChainInfo {
    if (typeof ref === 'number') {
      const hit = this.byId.get(ref);
      if (hit) return hit;
    }
    return this.resolve(String(ref));
  }

  /** resolve only by key / alias string */
  resolve(keyOrAlias: string): ChainInfo {
    const k = this.alias.get(keyOrAlias.toLowerCase()) ?? keyOrAlias.toLowerCase();
    const hit = this.byKey.get(k);
    if (!hit) throw new Error(`INVALID_CHAIN_KEY: ${keyOrAlias}`);
    return hit;
  }
}

/** Singleton used by all helpers unless caller passes an explicit registry */
export const defaultRegistry = new ChainRegistry();
