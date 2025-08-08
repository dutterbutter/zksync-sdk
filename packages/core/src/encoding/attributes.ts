import { keccak_256 } from '@noble/hashes/sha3';
import { hexToBytes, bytesToHex, concatBytes } from '@noble/hashes/utils';

// --- small internal helper: noble expects non-0x hex ---
const from0x = (hex: string) => hexToBytes(hex.startsWith('0x') ? hex.slice(2) : hex);

// ---- ABI utils (only uint256 and bytes needed) ----
function u256(n: bigint): Uint8Array {
  if (n < 0n) throw new Error('uint256 underflow');
  let hex = n.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  const src = from0x(hex);
  if (src.length > 32) throw new Error('uint256 overflow');
  const out = new Uint8Array(32);
  out.set(src, 32 - src.length); // left pad
  return out;
}

function encodeSelector(signature: string): Uint8Array {
  // keccak256(signature) and take first 4 bytes
  return keccak_256(new TextEncoder().encode(signature)).slice(0, 4);
}

function encodeFunctionData(
  signature: string,
  argKinds: ReadonlyArray<'uint256' | 'bytes'>,
  args: unknown[],
): `0x${string}` {
  if (argKinds.length !== args.length) {
    throw new Error(`arg length mismatch: expected ${argKinds.length}, got ${args.length}`);
  }

  const sel = encodeSelector(signature);

  const heads: Uint8Array[] = [];
  const tails: Uint8Array[] = [];
  let dynamicOffset = 32 * argKinds.length;

  for (let i = 0; i < argKinds.length; i++) {
    const kind = argKinds[i];
    const arg = args[i];

    if (kind === 'uint256') {
      const v = typeof arg === 'bigint' ? arg : BigInt(arg as string | number);
      heads.push(u256(v));
    } else if (kind === 'bytes') {
      // head = offset; tail = [len][data][zero-padding]
      heads.push(u256(BigInt(dynamicOffset)));

      const data: Uint8Array = typeof arg === 'string' ? from0x(arg) : (arg as Uint8Array);

      const len = u256(BigInt(data.length));
      const padLen = (32 - (data.length % 32 || 32)) % 32;
      const padded = padLen ? concatBytes(data, new Uint8Array(padLen)) : data;

      tails.push(concatBytes(len, padded));
      dynamicOffset += 32 + padded.length;
    } else {
      // Cast to string because `kind` is inferred as `never` here
      throw new Error(`Unsupported type: ${kind as string}`);
    }
  }

  const body = concatBytes(...heads, ...tails);

  return `0x${bytesToHex(concatBytes(sel, body))}`;
}

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
