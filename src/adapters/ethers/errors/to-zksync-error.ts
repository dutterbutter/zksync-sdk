/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { createError, shapeCause } from '../../../core/errors/factory';
import {
  isZKsyncError,
  type TryResult,
  type ErrorEnvelope,
  type ErrorType,
  type Resource,
} from '../../../core/types/errors';
import { decodeRevert } from '../errors/revert';

/**
 * Wrap any unknown error into a ZKsyncError with a chosen type+message.
 * Pick the type/message at the call site where you actually know the context.
 */
export function toZKsyncError(
  type: ErrorType,
  base: Omit<ErrorEnvelope, 'type' | 'revert' | 'cause'>,
  err: unknown,
) {
  if (isZKsyncError(err)) return err;

  const revert = decodeRevert(err);
  return createError(type, {
    ...base,
    ...(revert ? { revert } : {}),
    cause: shapeCause(err),
  });
}

export function makeErrorOps(resource: Resource) {
  type Ctx = Record<string, unknown>;

  async function withOp<T>(
    operation: string,
    message: string,
    ctx: Ctx,
    fn: () => Promise<T>,
  ): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (isZKsyncError(e)) throw e;
      throw toZKsyncError('INTERNAL', { resource, operation, context: ctx, message }, e);
    }
  }

  async function withRouteOp<T>(
    kind: 'RPC' | 'INTERNAL',
    operation: string,
    message: string,
    ctx: Ctx,
    fn: () => Promise<T>,
  ): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      throw toZKsyncError(kind, { resource, operation, context: ctx, message }, e);
    }
  }

  async function toResult<T>(
    operation: string,
    ctx: Ctx,
    fn: () => Promise<T>,
  ): Promise<TryResult<T>> {
    try {
      const value = await fn();
      return { ok: true, value };
    } catch (e) {
      return {
        ok: false,
        error: isZKsyncError(e)
          ? e
          : toZKsyncError(
              'INTERNAL',
              { resource, operation, context: ctx, message: `Internal error during ${operation}.` },
              e,
            ),
      };
    }
  }

  return { withOp, withRouteOp, toResult };
}
