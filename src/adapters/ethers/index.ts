// index.ts
export { createEthersClient as createClient } from './client';
export * from './client';
export * from './sdk';

// Adapter-specific resources/utilities
export * from './resources/utils';
export { createDepositsResource } from './resources/deposits';
export type { DepositsResource } from './resources/deposits';
export { createWithdrawalsResource } from './resources/withdrawals';
export type { WithdrawalsResource } from './resources/withdrawals';
export { createInteropResource } from './resources/interop';
export type { InteropResource } from './resources/interop';

// Errors adapted for ethers
export * from './errors/error-ops';
export * from './errors/revert';

// Types
export type * from './typechain';
