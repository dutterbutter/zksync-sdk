// src/core/errors/factory.ts
import { ZKsyncError, type ErrorEnvelope, type ErrorType } from '../types/errors';

export function createError(type: ErrorType, input: Omit<ErrorEnvelope, 'type'>): ZKsyncError {
  return new ZKsyncError({ ...input, type });
}
