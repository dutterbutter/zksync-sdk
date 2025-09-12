// src/core/types/errors.ts

// TODO: revisit these types
export type ErrorType = 'VALIDATION' | 'STATE' | 'EXECUTION' | 'RPC' | 'INTERNAL' | 'VERIFICATION';

/** Resource surface */
export type Resource =
  | 'deposits'
  | 'withdrawals'
  | 'withdrawal-finalization'
  | 'helpers'
  | 'zksrpc';

/** Envelope we throw only for SDK-domain errors. */
export interface ErrorEnvelope {
  /** Resource surface that raised the error. */
  resource: Resource;
  /** SDK operation, e.g. 'withdrawals.finalize' */
  operation: string;
  /** Broad category */
  type: ErrorType;
  /** Human-readable, stable message for developers. */
  message: string;

  /** Optional detail that adapters may enrich (reverts, extra context) */
  context?: Record<string, unknown>;

  /** If the error is a contract revert, adapters add decoded info here. */
  revert?: {
    /** 4-byte selector as 0x…8 hex */
    selector: `0x${string}`;
    /** Decoded error name when available (e.g. 'InvalidProof') */
    name?: string;
    /** Decoded args (ethers/viem output), when available */
    args?: unknown[];
    /** Optional adapter-known labels */
    contract?: string;
    fn?: string;
  };

  /** Original thrown error  */
  cause?: unknown;
}

/** Error class for all SDK errors. */
export class ZKsyncError extends Error {
  constructor(public readonly envelope: ErrorEnvelope) {
    super(envelope.message);
    this.name = 'ZKsyncError';
  }
}

export type TryResult<T> = { ok: true; value: T } | { ok: false; error: ZKsyncError };

export function isZKsyncError(e: unknown): e is ZKsyncError {
  return e instanceof ZKsyncError && !!e.envelope?.type && !!e.envelope?.message;
}
