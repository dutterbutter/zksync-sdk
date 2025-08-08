import { encodeFunctionData } from '../internal';

// ---- public API ----
const SIG = {
  interopCallValue: 'interopCallValue(uint256)',
  indirectCall: 'indirectCall(uint256)',
  executionAddress: 'executionAddress(bytes)',
  unbundlerAddress: 'unbundlerAddress(bytes)',
} as const;

export const ATTR = {
  interopCallValue: (value: bigint): `0x${string}` =>
    encodeFunctionData(SIG.interopCallValue, ['uint256'], [value]),

  indirectCall: (bridgeMsgValue: bigint): `0x${string}` =>
    encodeFunctionData(SIG.indirectCall, ['uint256'], [bridgeMsgValue]),

  executionAddress: (erc7930: `0x${string}`): `0x${string}` =>
    encodeFunctionData(SIG.executionAddress, ['bytes'], [erc7930]),

  unbundlerAddress: (erc7930: `0x${string}`): `0x${string}` =>
    encodeFunctionData(SIG.unbundlerAddress, ['bytes'], [erc7930]),
} as const;
