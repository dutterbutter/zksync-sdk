/* -------------------------------------------------------------------------- */
/*  internal/errors.ts  –  Ethers-adapter helpers                              */
/* -------------------------------------------------------------------------- */

import { parseRevertData, InteropError } from '@zksync-sdk/core';

type Hex = `0x${string}`;

/** Simple hex guard */
function isHexString(v: unknown): v is Hex {
  return typeof v === 'string' && v.startsWith('0x');
}

/** Narrow structural check without falling back to `any` */
function hasProp<T extends object, P extends keyof T>(
  obj: unknown,
  prop: P,
): obj is { [K in P]: T[P] } {
  return typeof obj === 'object' && obj !== null && prop in obj;
}

/** Extract revert data from the many shapes ethers can throw. */
export function extractRevertDataEthers(err: unknown): Hex | undefined {
  // eslint rules: first protect against primitive values
  if (typeof err !== 'object' || err === null) return undefined;

  /* -------------------------------------------------------------------- */
  /*  1.  ethers v6 common shapes: { error: { data } } or { data }        */
  /* -------------------------------------------------------------------- */
  if (hasProp<{ data?: unknown }, 'data'>(err, 'data') && isHexString(err.data)) {
    return err.data;
  }

  if (
    hasProp<{ error?: { data?: unknown } }, 'error'>(err, 'error') &&
    isHexString(err.error?.data)
  ) {
    return err.error.data;
  }

  /* -------------------------------------------------------------------- */
  /*  2.  http response body: body is JSON-string containing .error.data   */
  /* -------------------------------------------------------------------- */
  if (hasProp<{ body: unknown }, 'body'>(err, 'body') && typeof err.body === 'string') {
    try {
      // narrow after parse
      interface BodyShape {
        error?:
          | {
              data?: unknown;
            }
          | {
              data?: { data?: unknown };
            };
      }

      const rawParsed: unknown = JSON.parse(err.body);
      if (typeof rawParsed === 'object' && rawParsed !== null) {
        const parsed = rawParsed as BodyShape;

        if (isHexString(parsed.error?.data)) return parsed.error.data;
        const nestedData = (parsed.error?.data as { data?: unknown })?.data;
        if (isHexString(nestedData)) return nestedData;
      }
    } catch {
      /* swallow JSON parse errors – not a revert payload */
    }
  }

  /* -------------------------------------------------------------------- */
  /*  3.  Some providers wrap further: info.error.data                     */
  /* -------------------------------------------------------------------- */
  if (
    hasProp<{ info?: { error?: { data?: unknown } } }, 'info'>(err, 'info') &&
    isHexString(err.info?.error?.data)
  ) {
    return err.info.error.data;
  }

  return undefined;
}

/* -------------------------------------------------------------------------- */
/*  fromEthersError – adapter wrapper that calls core’s parseRevertData       */
/* -------------------------------------------------------------------------- */
export function fromEthersError(e: unknown, ctx = 'ethers-call'): InteropError {
  const data = extractRevertDataEthers(e);
  if (data) {
    const decoded = parseRevertData(data);
    if (decoded) {
      return new InteropError(decoded.code, `${ctx}: ${decoded.name}`, {
        revertData: data,
        args: decoded.args,
        cause: e,
      });
    }
  }
  return new InteropError('SEND_FAILED', `${ctx}: EVM call failed`, { cause: e });
}
