import { createError, shapeCause } from '../errors/factory';
import { isZKsyncError } from '../types/errors';

type Ctx = Record<string, unknown>;
export const RESOURCE = 'zksrpc';

export async function withRpcOp<T>(
  operation: string,
  message: string,
  ctx: Ctx,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (isZKsyncError(e)) throw e;
    throw createError('RPC', {
      resource: RESOURCE,
      operation,
      message,
      context: ctx,
      cause: shapeCause(e),
    });
  }
}
