import type { ChainRef, ChainInfo } from '@zksync-sdk/core';

type RegistryWithResolveRef = { resolveRef(ref: ChainRef): ChainInfo };
type RegistryWithResolve = { resolve(keyOrAlias: string): ChainInfo };
type ChainRegistry = RegistryWithResolveRef | RegistryWithResolve;

function hasResolveRef(r: unknown): r is RegistryWithResolveRef {
  return !!r && typeof (r as Record<string, unknown>).resolveRef === 'function';
}
function hasResolve(r: unknown): r is RegistryWithResolve {
  return !!r && typeof (r as Record<string, unknown>).resolve === 'function';
}

export function resolveChain(
  registry: ChainRegistry | RegistryWithResolveRef | RegistryWithResolve,
  ref: ChainRef,
): ChainInfo {
  if (hasResolveRef(registry)) return registry.resolveRef(ref);
  if (hasResolve(registry)) return registry.resolve(String(ref));
  throw new Error('CONFIG_MISSING: registry must implement resolveRef or resolve');
}
