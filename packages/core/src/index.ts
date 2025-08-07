// ---- Public types/constants first (source of truth) ----
export * from './types';

// ---- Encoding helpers (pure, runtime-agnostic) ----
export * from './encoding/7930';
export * from './encoding/attributes';

// ---- ABIs (typed `as const` fragments) ----
// Canonical file names:
export { IInteropCenterAbi } from './abis/IInteropCenter';
export type { IInteropCenterAbi as InteropCenterAbiType } from './abis/IInteropCenter';

export { IERC7786GatewaySourceAbi } from './abis/IERC7786GatewaySource';
export type { IERC7786GatewaySourceAbi as ERC7786GatewaySourceAbiType } from './abis/IERC7786GatewaySource';

export { IInteropHandlerAbi } from './abis/IInteropHandler';
export type { IInteropHandlerAbi as InteropHandlerAbiType } from './abis/IInteropHandler';

// Aliases:
export {
  IInteropHandlerAbi as InteropHandlerAbi,
} from './abis/IInteropHandler';
export {
    IInteropCenterAbi as InteropCenterAbi,
} from './abis/IInteropCenter';
export { IERC7786GatewaySourceAbi as ERC7786GatewaySourceAbi } from './abis/IERC7786GatewaySource';

// ---- Bundle ----
export { bundle } from './bundle';

// ---- Utilities ----
export * from './utils';

// ---- Errors (class + decoders). Error *codes* live in types.ts ----
export * from './errors';

// ---- Chain registry ----
export { ChainRegistry, defaultRegistry } from './chains/registry';
export { builtinChains, Chains } from './chains';
