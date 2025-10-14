// src/core/resources/interop/actions.ts
import type { Address, Hex } from '../../types/primitives';
import type { InteropAction } from '../../types/flows/interop';

/** String literals as constants (nice for autocomplete, refactors) */
export const INTEROP_ACTION = {
  CALL: 'call',
  SEND_NATIVE: 'sendNative',
  SEND_ERC20: 'sendErc20',
} as const;

export const actions = {
  call(to: Address, data: Hex, value?: bigint): InteropAction {
    // include value only when explicitly provided (0n is valid)
    return (
      value !== undefined
        ? { type: INTEROP_ACTION.CALL, to, data, value }
        : { type: INTEROP_ACTION.CALL, to, data }
    ) as InteropAction;
  },

  sendNative(to: Address, amount: bigint): InteropAction {
    return { type: INTEROP_ACTION.SEND_NATIVE, to, amount };
  },

  sendErc20(token: Address, to: Address, amount: bigint): InteropAction {
    return { type: INTEROP_ACTION.SEND_ERC20, token, to, amount };
  },
} as const;

// Type guards
export function isCall(a: InteropAction): a is Extract<InteropAction, { type: 'call' }> {
  return a.type === INTEROP_ACTION.CALL;
}
export function isSendNative(
  a: InteropAction,
): a is Extract<InteropAction, { type: 'sendNative' }> {
  return a.type === INTEROP_ACTION.SEND_NATIVE;
}
export function isSendErc20(a: InteropAction): a is Extract<InteropAction, { type: 'sendErc20' }> {
  return a.type === INTEROP_ACTION.SEND_ERC20;
}
