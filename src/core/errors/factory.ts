/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

// src/core/errors/factory.ts
import { ZKsyncError, type ErrorEnvelope, type ErrorType } from '../types/errors';

export function createError(type: ErrorType, input: Omit<ErrorEnvelope, 'type'>): ZKsyncError {
  return new ZKsyncError({ ...input, type });
}

export function shapeCause(err: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = err as any;
  const data = e?.data?.data ?? e?.error?.data ?? e?.data ?? undefined;
  return {
    name: typeof e?.name === 'string' ? e.name : undefined,
    message:
      typeof e?.message === 'string'
        ? e.message
        : typeof e?.shortMessage === 'string'
          ? e.shortMessage
          : undefined,
    code: e?.code,
    data: typeof data === 'string' && data.startsWith('0x') ? `${data.slice(0, 10)}…` : undefined,
  };
}

