/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
// src/core/types/errors.ts
import util from 'node:util';
import { formatEnvelopePretty } from '../errors/formatter';

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
    super(formatEnvelopePretty(envelope), envelope.cause ? { cause: envelope.cause } : undefined);
    this.name = 'ZKsyncError';
  }

  [util.inspect.custom]() {
    return `${this.name}: ${formatEnvelopePretty(this.envelope)}`;
  }

  toJSON() {
    return { name: this.name, ...this.envelope };
  }
}

//  ---- Factory & type guards ----
export function isZKsyncError(e: unknown): e is ZKsyncError {
  return (
    !!e &&
    typeof e === 'object' &&
    'envelope' in (e as any) &&
    typeof (e as any).envelope?.type === 'string' &&
    typeof (e as any).envelope?.message === 'string'
  );
}

export type TryResult<T> = { ok: true; value: T } | { ok: false; error: ZKsyncError };

export const OP_DEPOSITS = {
  quote: 'deposits.quote',
  tryQuote: 'deposits.tryQuote',
  prepare: 'deposits.prepare',
  tryPrepare: 'deposits.tryPrepare',
  create: 'deposits.create',
  tryCreate: 'deposits.tryCreate',
  status: 'deposits.status',
  wait: 'deposits.wait',
  tryWait: 'deposits.tryWait',
  base: {
    allowance: 'deposits.erc20-base:allowance',
    baseCost: 'deposits.erc20-base:l2TransactionBaseCost',
    encodeCalldata: 'deposits.erc20-base:encodeSecondBridgeErc20Args',
    estGas: 'deposits.erc20-base:estimateGas',
  },
  nonbase: {
    allowance: 'deposits.erc20-nonbase:allowance',
    baseCost: 'deposits.erc20-nonbase:l2TransactionBaseCost',
    encodeCalldata: 'deposits.erc20-nonbase:encodeSecondBridgeErc20Args',
    estGas: 'deposits.erc20-nonbase:estimateGas',
  },
  eth: {
    baseCost: 'deposits.eth:l2TransactionBaseCost',
    estGas: 'deposits.eth:estimateGas',
  },
} as const;

// src/core/types/errors.ts (or your ops constants file)
export const OP_WITHDRAWALS = {
  quote: 'withdrawals.quote',
  tryQuote: 'withdrawals.tryQuote',
  prepare: 'withdrawals.prepare',
  tryPrepare: 'withdrawals.tryPrepare',
  create: 'withdrawals.create',
  tryCreate: 'withdrawals.tryCreate',
  status: 'withdrawals.status',
  wait: 'withdrawals.wait',
  tryWait: 'withdrawals.tryWait',
  erc20: {
    allowance: 'withdrawals.erc20:allowance',
    ensureRegistered: 'withdrawals.erc20:ensureTokenIsRegistered',
    encodeAssetData: 'withdrawals.erc20:encodeAssetData',
    encodeWithdraw: 'withdrawals.erc20:encodeWithdraw',
    estGas: 'withdrawals.erc20:estimateGas',
  },
  eth: {
    encodeWithdraw: 'withdrawals.eth:encodeWithdraw',
    estGas: 'withdrawals.eth:estimateGas',
  },
  finalize: {
    fetchParams: {
      receipt: 'withdrawals.finalize.fetchParams:receipt',
      findMessage: 'withdrawals.finalize.fetchParams:findMessage',
      decodeMessage: 'withdrawals.finalize.fetchParams:decodeMessage',
      rawReceipt: 'withdrawals.finalize.fetchParams:rawReceipt',
      messengerIndex: 'withdrawals.finalize.fetchParams:messengerIndex',
      proof: 'withdrawals.finalize.fetchParams:proof',
      network: 'withdrawals.finalize.fetchParams:network',
      ensureAddresses: 'withdrawals.finalize.fetchParams:ensureAddresses',
    },
    readiness: {
      ensureAddresses: 'withdrawals.finalize.readiness:ensureAddresses',
      isFinalized: 'withdrawals.finalize.readiness:isWithdrawalFinalized',
      simulate: 'withdrawals.finalize.readiness:simulate',
    },
    isFinalized: 'withdrawals.finalize.isWithdrawalFinalized',
    send: 'withdrawals.finalize.finalizeDeposit:send',
    wait: 'withdrawals.finalize.finalizeDeposit:wait',
  },
} as const;
