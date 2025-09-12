/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { createError } from '../../../core/errors/factory';
import { type ErrorEnvelope, type ErrorType } from '../../../core/types/errors';
import { decodeRevert } from '../errors/revert';

/**
 * Wrap any unknown error into a ZKsyncError with a chosen type+message.
 * Pick the type/message at the call site where you actually know the context.
 */
export function toZKsyncError(
  type: ErrorType,
  base: Omit<ErrorEnvelope, 'type' | 'revert' | 'cause'>,
  err: unknown,
  message: string,
) {
  const revert = decodeRevert(err);
  return createError(type, {
    ...base,
    ...(revert ? { revert } : {}),
    cause: shapeCause(err),
    message,
  });
}

function shapeCause(err: unknown) {
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
