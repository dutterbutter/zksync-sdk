import type { Address, Hex } from '../types/primitives';
import { encodeFunctionCall, type AbiType } from './abi';

export type BuiltTx = { to: Address; data: Hex; value?: bigint; meta?: Record<string, unknown> };

export function buildTx(
  to: Address,
  data: Hex,
  value?: bigint,
  meta?: Record<string, unknown>,
): BuiltTx {
  return { to, data, value, meta };
}

/** Encode a function call (no provider dependency). */
export function encodeCall(
  signature: string,
  types: readonly AbiType[],
  values: readonly unknown[],
): Hex {
  return encodeFunctionCall(signature, types, values);
}
