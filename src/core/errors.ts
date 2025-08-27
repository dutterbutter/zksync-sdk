import type { ZkOsError, ErrorCode } from '../types/errors';

export function makeError(
  code: ErrorCode,
  message: string,
  meta?: Record<string, unknown>,
): ZkOsError {
  const kind =
    code === 'VALIDATION' || code === 'CONFIG'
      ? 'ValidationError'
      : code === 'GAS_ESTIMATION_FAILED'
        ? 'GasEstimationFailed'
        : code === 'SEND_FAILED'
          ? 'SendFailed'
          : code === 'TIMEOUT'
            ? 'FinalityTimeout'
            : code === 'UNSUPPORTED'
              ? 'Unsupported'
              : 'OnChainRevert';

  return {
    kind,
    code,
    message,
    meta,
  };
}
