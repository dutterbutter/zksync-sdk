import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import type { InteropErrorCode } from './types';

function strip0x(h: string): string {
  return h.startsWith('0x') || h.startsWith('0X') ? h.slice(2) : h;
}

export type InteropErrorDetails = { cause?: unknown } & Record<string, unknown>;

export class InteropError extends Error {
  code: InteropErrorCode;
  details?: Record<string, unknown>;
  cause?: unknown;

  constructor(code: InteropErrorCode, message: string, details?: InteropErrorDetails) {
    super(message);
    this.name = 'InteropError';
    this.code = code;

    if (details && 'cause' in details) {
      const { cause, ...rest } = details;
      this.cause = cause;
      this.details = rest;
    } else if (details) {
      this.details = details as Record<string, unknown>;
    }
  }
}

/* -------------------------------------------------------------------------------------------------
 * EVM revert decoding (pure)
 * - Decodes custom interop errors (selectors provided)
 * - Also handles Error(string) and Panic(uint256)
 * - No ethers/viem/provider coupling
 * ------------------------------------------------------------------------------------------------ */

type Hex = `0x${string}`;

// 4-byte selectors (from InteropErrors.sol)
const SEL = {
  AttributeAlreadySet: '0x9031f751',
  AttributeViolatesRestriction: '0xbcb41ec7',
  BundleAlreadyProcessed: '0x5bba5111',
  BundleVerifiedAlready: '0xa43d2953',
  CallAlreadyExecuted: '0xd5c7a376',
  CallNotExecutable: '0xc087b727',
  CanNotUnbundle: '0xf729f26d',
  ExecutingNotAllowed: '0xe845be4c',
  IndirectCallValueMismatch: '0x62d214aa',
  InteroperableAddressChainReferenceNotEmpty: '0xfe8b1b16',
  InteroperableAddressNotEmpty: '0x884f49ba',
  MessageNotIncluded: '0x32c2e156',
  UnauthorizedMessageSender: '0x89fd2c76',
  UnbundlingNotAllowed: '0x0345c281',
  WrongCallStatusLength: '0x801534e9',
  WrongDestinationChainId: '0x4534e972',

  // Standard:
  ErrorString: '0x08c379a0', // Error(string)
  Panic: '0x4e487b71',       // Panic(uint256)
} as const;

type Arg = string | bigint;

/** Minimal decoder for the types we need: bytes4, bytes32, bytes, uint256, address, string. */
function decodeArgs(types: string[], data: Hex): Arg[] {
  const u8 = hexToBytes(strip0x(data));
  if (u8.length < 4) return [];

  const body = u8.slice(4);

  const readU256 = (start: number) => {
    const v = body.slice(start, start + 32);
    const hex = bytesToHex(v);               // no .slice(2) !
    return BigInt('0x' + hex);
  };

  const readAddress = (start: number) => {
    const v = body.slice(start + 12, start + 32);
    return ('0x' + bytesToHex(v)) as Hex;    // 20 bytes, 0x-prefixed
  };

  const readFixed = (start: number, size: number) =>
    ('0x' + bytesToHex(body.slice(start, start + size))) as Hex;

  const readDyn = (offset: number) => {
    const off = Number(readU256(offset));
    const len = Number(readU256(off));
    const v = body.slice(off + 32, off + 32 + len);
    return ('0x' + bytesToHex(v)) as Hex;    // 0x-prefixed
  };

  const out: Arg[] = [];
  for (let i = 0; i < types.length; i++) {
    const head = i * 32;
    switch (types[i]) {
      case 'uint256': out.push(readU256(head)); break;
      case 'bytes4':  out.push(readFixed(head + 28, 4)); break;
      case 'bytes32': out.push(readFixed(head, 32)); break;
      case 'address': out.push(readAddress(head)); break;
      case 'bytes':   out.push(readDyn(head)); break;
      case 'string': {
        const hex = readDyn(head);           // 0x-prefixed
        const buf = hexToBytes(strip0x(hex));
        out.push(new TextDecoder().decode(buf));
        break;
      }
      default:
        out.push(readFixed(head, 32));
    }
  }
  return out;
}


type KnownDecoded =
  | { code: InteropErrorCode; name: string; args?: Record<string, Arg> }
  | undefined;

/** Pure decoder: feed it a revert data hex, get a normalized shape or undefined. */
export function parseRevertData(data: Hex): KnownDecoded {
  if (!data || data === '0x' || data.length < 10) return;

  const selector = data.slice(0, 10).toLowerCase();

  // Error(string)
  if (selector === SEL.ErrorString) {
    const [message] = decodeArgs(['string'], data) as [string];
    return { code: 'EVM_ERROR', name: 'Error(string)', args: { message } };
  }

  // Panic(uint256)
  if (selector === SEL.Panic) {
    const [panicCode] = decodeArgs(['uint256'], data) as [bigint];
    return { code: 'EVM_PANIC', name: 'Panic(uint256)', args: { panicCode } };
  }

  // Custom interop errors
  switch (selector) {
    case SEL.AttributeAlreadySet: {
      const [sel] = decodeArgs(['bytes4'], data);
      return { code: 'ATTR_ALREADY_SET', name: 'AttributeAlreadySet', args: { selector: sel } };
    }
    case SEL.AttributeViolatesRestriction: {
      const [sel, restriction] = decodeArgs(['bytes4', 'uint256'], data);
      return { code: 'ATTR_VIOLATES_RESTRICTION', name: 'AttributeViolatesRestriction', args: { selector: sel, restriction } };
    }
    case SEL.BundleAlreadyProcessed: {
      const [bundleHash] = decodeArgs(['bytes32'], data);
      return { code: 'BUNDLE_ALREADY_PROCESSED', name: 'BundleAlreadyProcessed', args: { bundleHash } };
    }
    case SEL.BundleVerifiedAlready: {
      const [bundleHash] = decodeArgs(['bytes32'], data);
      return { code: 'BUNDLE_ALREADY_VERIFIED', name: 'BundleVerifiedAlready', args: { bundleHash } };
    }
    case SEL.CallAlreadyExecuted: {
      const [bundleHash, callIndex] = decodeArgs(['bytes32', 'uint256'], data);
      return { code: 'CALL_ALREADY_EXECUTED', name: 'CallAlreadyExecuted', args: { bundleHash, callIndex } };
    }
    case SEL.CallNotExecutable: {
      const [bundleHash, callIndex] = decodeArgs(['bytes32', 'uint256'], data);
      return { code: 'CALL_NOT_EXECUTABLE', name: 'CallNotExecutable', args: { bundleHash, callIndex } };
    }
    case SEL.CanNotUnbundle: {
      const [bundleHash] = decodeArgs(['bytes32'], data);
      return { code: 'CANNOT_UNBUNDLE', name: 'CanNotUnbundle', args: { bundleHash } };
    }
    case SEL.ExecutingNotAllowed: {
      const [bundleHash, callerAddress, executionAddress] = decodeArgs(['bytes32', 'bytes', 'bytes'], data);
      return { code: 'EXECUTING_NOT_ALLOWED', name: 'ExecutingNotAllowed', args: { bundleHash, callerAddress, executionAddress } };
    }
    case SEL.IndirectCallValueMismatch: {
      const [expected, actual] = decodeArgs(['uint256', 'uint256'], data);
      return { code: 'INDIRECT_CALL_VALUE_MISMATCH', name: 'IndirectCallValueMismatch', args: { expected, actual } };
    }
    case SEL.InteroperableAddressChainReferenceNotEmpty: {
      const [interoperableAddress] = decodeArgs(['bytes'], data);
      return { code: 'CHAIN_REFERENCE_NOT_EMPTY', name: 'InteroperableAddressChainReferenceNotEmpty', args: { interoperableAddress } };
    }
    case SEL.InteroperableAddressNotEmpty: {
      const [interoperableAddress] = decodeArgs(['bytes'], data);
      return { code: 'INTEROP_ADDRESS_NOT_EMPTY', name: 'InteroperableAddressNotEmpty', args: { interoperableAddress } };
    }
    case SEL.MessageNotIncluded: {
      return { code: 'MESSAGE_NOT_INCLUDED', name: 'MessageNotIncluded' };
    }
    case SEL.UnauthorizedMessageSender: {
      const [expected, actual] = decodeArgs(['address', 'address'], data);
      return { code: 'UNAUTHORIZED_MESSAGE_SENDER', name: 'UnauthorizedMessageSender', args: { expected, actual } };
    }
    case SEL.UnbundlingNotAllowed: {
      const [bundleHash, callerAddress, unbundlerAddress] = decodeArgs(['bytes32', 'bytes', 'bytes'], data);
      return { code: 'UNBUNDLING_NOT_ALLOWED', name: 'UnbundlingNotAllowed', args: { bundleHash, callerAddress, unbundlerAddress } };
    }
    case SEL.WrongCallStatusLength: {
      const [bundleCallsLength, providedCallStatusLength] = decodeArgs(['uint256', 'uint256'], data);
      return { code: 'WRONG_CALL_STATUS_LENGTH', name: 'WrongCallStatusLength', args: { bundleCallsLength, providedCallStatusLength } };
    }
    case SEL.WrongDestinationChainId: {
      const [bundleHash, expected, actual] = decodeArgs(['bytes32', 'uint256', 'uint256'], data);
      return { code: 'WRONG_DESTINATION_CHAIN_ID', name: 'WrongDestinationChainId', args: { bundleHash, expected, actual } };
    }
  }

  // Unknown selector
  return { code: 'SEND_FAILED', name: 'UnknownRevert', args: { selector } };
}

/** Build an InteropError from a revert data hex (adapters should call this). */
export function interopErrorFromRevertData(
  data: Hex,
  cause?: unknown,
  context?: string
): InteropError {
  const decoded = parseRevertData(data);
  if (decoded) {
    const msg = context ? `${context}: ${decoded.name}` : decoded.name;
    return new InteropError(decoded.code, msg, { decoded, revertData: data, cause });
  }
  return new InteropError('SEND_FAILED', context ? `${context}: EVM call failed` : 'EVM call failed', {
    revertData: data,
    cause
  });
}
