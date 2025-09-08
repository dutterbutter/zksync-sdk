import type { Hex } from './primitives';

export type ErrorKind =
  | 'ValidationError'
  | 'Config'
  | 'GasEstimationFailed'
  | 'SendFailed'
  | 'OnChainRevert'
  | 'FinalityTimeout'
  | 'Unsupported';

export type ErrorCode =
  // Generic
  | 'VALIDATION'
  | 'CONFIG'
  | 'GAS_ESTIMATION_FAILED'
  | 'SEND_FAILED'
  | 'ONCHAIN_REVERT'
  | 'TIMEOUT'
  | 'UNSUPPORTED'
  // Bridges / interop (seed a few now; more later)
  | 'NO_ETH_ALLOWED'
  | 'TOKEN_NOT_SUPPORTED'
  | 'AMOUNT_TOO_LOW'
  | 'WRONG_DESTINATION_CHAIN_ID';

export interface ZkOsError {
  kind: ErrorKind;
  code: ErrorCode;
  message: string;
  /** 4-byte selector if revert data present */
  selector?: Hex;
  /** Decoded error args (preserve high-signal types like address/uint256/bytes32) */
  args?: unknown[];
  /** Structured context (tx hash, route, chain ids, etc.) */
  meta?: Record<string, unknown>;
  /** Raw/cascaded provider error or string */
  cause?: unknown;
}

export type Ok<T> = { ok: true; value: T };
export type Err<E extends ZkOsError = ZkOsError> = { ok: false; error: E };
export type Result<T, E extends ZkOsError = ZkOsError> = Ok<T> | Err<E>;
