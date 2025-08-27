import { keccak_256 } from '@noble/hashes/sha3';
import type { Address, Hex } from '../types/primitives';
import type { ErrorCode, ZkOsError } from '../types/errors';

// -----------------------------
// Hex & bytes helpers
// -----------------------------
export function assertHex(x: string): asserts x is Hex {
  if (typeof x !== 'string' || !/^0x[0-9a-fA-F]*$/.test(x)) {
    throw new Error(`Expected hex string, got: ${x}`);
  }
}
export function strip0x(x: string): string {
  return x.startsWith('0x') ? x.slice(2) : x;
}
export function add0x(x: string): Hex {
  return `0x${strip0x(x)}`;
}
export function bytesToHex(uint8: Uint8Array): Hex {
  const hex: string[] = Array.from(uint8, (b) => b.toString(16).padStart(2, '0'));
  return add0x(hex.join(''));
}
export function hexToBytes(h: Hex): Uint8Array {
  assertHex(h);
  const s = strip0x(h);
  if (s.length % 2 !== 0) throw new Error(`Bad hex length: ${h}`);
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}
export function pad32(hex: Hex): Hex {
  assertHex(hex);
  const s = strip0x(hex);
  if (s.length > 64) throw new Error(`Value over 32 bytes: ${hex}`);
  return add0x(s.padStart(64, '0'));
}
export function concatHex(...parts: Hex[]): Hex {
  return add0x(parts.map(strip0x).join(''));
}

// -----------------------------
// Keccak & selectors
// -----------------------------
export function keccak256(data: Uint8Array | string): Hex {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  return add0x(Buffer.from(keccak_256(bytes)).toString('hex'));
}
export function selector(signature: string): Hex {
  const hash = keccak256(signature);
  return add0x(strip0x(hash).slice(0, 8)); // 4 bytes = 8 hex chars
}

// -----------------------------
// ABI encode (static types + bytes)
// -----------------------------
export type AbiType = 'address' | 'uint256' | 'uint32' | 'bytes32' | 'bytes';

function isDynamic(t: AbiType): boolean {
  return t === 'bytes';
}

function encAddress(v: Address): Hex {
  if (!/^0x[0-9a-fA-F]{40}$/.test(v)) throw new Error(`Bad address: ${v}`);
  return pad32(add0x(strip0x(v).toLowerCase()));
}

function encUint(v: bigint, bits: 256 | 32 = 256): Hex {
  if (v < 0n) throw new Error(`Negative uint: ${v}`);
  // Range checks (loose; primarily to catch obvious issues)
  if (bits === 32 && v > (1n << 32n) - 1n) throw new Error(`uint32 overflow: ${v}`);
  // ABI uses 32-byte words; smaller uints are still left-padded
  return pad32(add0x(v.toString(16)));
}

function encBytes32(v: Hex): Hex {
  assertHex(v);
  const s = strip0x(v);
  if (s.length !== 64) throw new Error(`bytes32 must be 32 bytes: ${v}`);
  return add0x(s);
}

/** Dynamic bytes: head = offset, tail = length + data + padding */
function encBytes(v: Hex): { head: Hex; tail: Hex } {
  assertHex(v);
  const data = add0x(strip0x(v));
  const len = BigInt(strip0x(data).length / 2);
  const lenWord = encUint(len);
  // pad to 32-byte multiple
  const padLen = (32 - (Number(len) % 32)) % 32;
  const tail = concatHex(lenWord, add0x(strip0x(data).padEnd(Number(len) * 2 + padLen * 2, '0')));
  // head (offset) is set by encAbi once layout is known
  return { head: '0x', tail };
}

/** Encodes arguments per Solidity ABI (subset: static + bytes) */
export function encodeAbi(types: readonly AbiType[], values: readonly unknown[]): Hex {
  if (types.length !== values.length) throw new Error('types/values length mismatch');

  // heads & tails
  const heads: Hex[] = [];
  const tails: Hex[] = [];
  let dynamicOffset = 32n * BigInt(types.length); // initial head size in bytes

  for (let i = 0; i < types.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const t = types[i]!;
    const v = values[i]!;
    if (!isDynamic(t)) {
      switch (t) {
        case 'address':
          heads.push(encAddress(v as Address));
          break;
        case 'uint256':
          heads.push(encUint(v as bigint, 256));
          break;
        case 'uint32':
          heads.push(encUint(v as bigint, 32));
          break;
        case 'bytes32':
          heads.push(encBytes32(v as Hex));
          break;
        default:
          throw new Error(`Unsupported static type: ${t}`);
      }
    } else {
      // bytes
      const { tail } = encBytes(v as Hex);
      heads.push(encUint(dynamicOffset, 256)); // offset
      tails.push(tail);
      dynamicOffset += BigInt(strip0x(tail).length / 2);
    }
  }

  return concatHex(...heads, ...tails);
}

/** Encodes function call: 0x + 4-byte selector + encoded args */
export function encodeFunctionCall(
  signature: string,
  types: readonly AbiType[],
  values: readonly unknown[],
): Hex {
  return concatHex(selector(signature), encodeAbi(types, values));
}

// -----------------------------
// Custom error decoding (selector → types)
// -----------------------------
type ErrorSpec = { name: string; code: ErrorCode; types: AbiType[] };

// Seeded from your spec (expand over time)
const ERROR_SPECS: Record<string, ErrorSpec> = {
  // L1BridgeHubErrors.sol
  '0x7f4316f3': { name: 'NoEthAllowed', code: 'NO_ETH_ALLOWED', types: [] },
  '0xa2ac02a0': { name: 'NotRelayedSender', code: 'UNSUPPORTED', types: ['address', 'address'] },
  '0xf306a770': { name: 'NotAssetRouter', code: 'UNSUPPORTED', types: ['address', 'address'] },
  '0x913183d8': { name: 'MessageRootNotRegistered', code: 'UNSUPPORTED', types: [] },
  // L1BridgeErrors.sol
  '0xe4742c42': { name: 'ZeroAmountToTransfer', code: 'AMOUNT_TOO_LOW', types: [] },
  '0xb4aeddbc': { name: 'WrongCounterpart', code: 'TOKEN_NOT_SUPPORTED', types: [] },
  // Generic interop (examples)
  '0x0e52d9da': { name: 'WrongDestinationChainId', code: 'WRONG_DESTINATION_CHAIN_ID', types: [] }, // selector placeholder if present on-chain
};

function decodeArgs(types: AbiType[], data: Hex): unknown[] {
  // minimal decode for static types + bytes
  const out: unknown[] = [];
  let offset = 0;
  const body = strip0x(data);

  function word(i: number): string {
    return body.slice(i * 64, (i + 1) * 64);
  }

  // Read dynamic tails lazily
  for (let i = 0; i < types.length; i++) {
    const t = types[i];
    if (!isDynamic(t)) {
      const w = word(i);
      if (t === 'address') out.push(add0x(w.slice(24 * 2)));
      else if (t === 'uint256' || t === 'uint32') out.push(BigInt('0x' + w));
      else if (t === 'bytes32') out.push(add0x(w));
    } else {
      // bytes: head contains offset
      const off = Number(BigInt('0x' + word(i)));
      const len = Number(BigInt('0x' + body.slice(off * 2, off * 2 + 64)));
      const bytesHex = add0x(body.slice(off * 2 + 64, off * 2 + 64 + len * 2));
      out.push(bytesHex);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    offset += 32;
  }
  return out;
}

/** Best-effort revert-data decoder into our error envelope fields. */
export function decodeRevert(
  data?: Hex,
): Pick<ZkOsError, 'selector' | 'args' | 'code' | 'message'> | null {
  if (!data) return null;
  assertHex(data);
  const body = strip0x(data);
  if (body.length < 8) return null;
  const sel = add0x(body.slice(0, 8));
  const spec = ERROR_SPECS[sel.toLowerCase()];
  if (!spec) {
    return { selector: sel, code: 'ONCHAIN_REVERT', message: 'EVM revert (unknown selector)' };
  }
  const argsData = add0x(body.slice(8));
  const args = spec.types.length ? decodeArgs(spec.types, argsData) : [];
  return {
    selector: sel,
    args,
    code: spec.code,
    message: spec.name,
  };
}
