export { createViemClient as createClient } from './client';
export * from './client';
export * from './sdk';

export * from './resources/utils';
export { createDepositsResource } from './resources/deposits';
export type { DepositsResource } from './resources/deposits';
export { createWithdrawalsResource } from './resources/withdrawals';
export type { WithdrawalsResource } from './resources/withdrawals';

export * from './errors/error-ops';
export * from './errors/revert';
