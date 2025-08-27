import type { Hash } from './primitives';

export interface BaseHandle {
  /** Marker for narrowing in unions */
  kind: string;
  /** L1 tx hash, when the action originates on L1 */
  l1TxHash?: Hash;
  /** L2 tx hash, when directly sent on L2 */
  l2TxHash?: Hash;
  /** Creation timestamp (ms) for telemetry */
  createdAt: number;
}

export interface DepositHandle extends BaseHandle {
  kind: 'deposit';
}

export interface WithdrawHandle extends BaseHandle {
  kind: 'withdraw';
}

export interface TransferHandle extends BaseHandle {
  kind: 'transfer';
  /** Optional interop message key / id */
  messageKey?: string;
}

export interface RemoteCallHandle extends BaseHandle {
  kind: 'remoteCall';
  messageKey?: string;
}

export interface BundleHandle extends BaseHandle {
  kind: 'bundle';
  bundleId?: string;
}
