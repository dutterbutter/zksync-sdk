// src/chains/index.ts
import { era } from './era';
import { abs } from './abs';
import { local_era, local_gateway, local_val } from './local';
import { localAnvilZKsync } from './localAnvilZKsync';
import type { ChainKey } from '../types';

export const builtinChains = [
  era,
  abs,
  local_era,
  local_gateway,
  local_val,
  localAnvilZKsync,
] as const;

export const Chains = Object.fromEntries(builtinChains.map((c) => [c.key, c.key])) as Record<
  ChainKey,
  ChainKey
>;
