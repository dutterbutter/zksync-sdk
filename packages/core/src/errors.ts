// packages/core/src/errors.ts

import type { InteropErrorCode } from './types';
import type { Hex } from './internal/hex';
import { readAsBigHex, hexToBytes } from './internal/hex';

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

  ErrorString: '0x08c379a0',
  Panic: '0x4e487b71',
} as const;

type Arg = string | bigint;

function decodeArgs(types: string[], data: Hex): Arg[] {
  // selector (4 bytes) + body
  const u8 = hexToBytes(data);
  if (u8.length < 4) return [];

  const body = u8.subarray(4);

  const readU256 = (headOffset: number): bigint => {
    const hex = readAsBigHex(body, headOffset, 32);
    if (!hex) return 0n; // OOB → 0
    return BigInt(hex); // hex is already 0x-prefixed
  };

  const readAddress = (headOffset: number): Hex => {
    // address is last 20 bytes of the 32B head word
    return readAsBigHex(body, headOffset + 12, 20) ?? '0x';
  };

  const readFixed = (headOffset: number, size: number): Hex => {
    return readAsBigHex(body, headOffset, size) ?? '0x';
  };

  const readDyn = (headOffset: number): Hex => {
    const off = Number(readU256(headOffset)); // byte offset into body
    if (!Number.isFinite(off) || off < 0 || off + 32 > body.length) return '0x';
    const len = Number(readU256(off));
    const dataHex =
      readAsBigHex(body, off + 32, Math.max(0, Math.min(len, body.length - (off + 32)))) ?? '0x';
    return dataHex;
  };

  const out: Arg[] = [];
  for (let i = 0; i < types.length; i++) {
    const head = i * 32;
    switch (types[i]) {
      case 'uint256':
        out.push(readU256(head));
        break;
      case 'bytes4':
        out.push(readFixed(head + 28, 4));
        break;
      case 'bytes32':
        out.push(readFixed(head, 32));
        break;
      case 'address':
        out.push(readAddress(head));
        break;
      case 'bytes':
        out.push(readDyn(head));
        break;
      case 'string': {
        const hex = readDyn(head);
        const buf = hexToBytes(hex);
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

export function parseRevertData(data: Hex): KnownDecoded {
  if (!data || data === '0x' || data.length < 10) return;

  const selector = data.slice(0, 10).toLowerCase();

  if (selector === SEL.ErrorString) {
    const [message] = decodeArgs(['string'], data) as [string];
    return { code: 'EVM_ERROR', name: 'Error(string)', args: { message } };
  }

  if (selector === SEL.Panic) {
    const [panicCode] = decodeArgs(['uint256'], data) as [bigint];
    return { code: 'EVM_PANIC', name: 'Panic(uint256)', args: { panicCode } };
  }

  switch (selector) {
    case SEL.AttributeAlreadySet: {
      const [sel] = decodeArgs(['bytes4'], data);
      return { code: 'ATTR_ALREADY_SET', name: 'AttributeAlreadySet', args: { selector: sel } };
    }
    case SEL.AttributeViolatesRestriction: {
      const [sel, restriction] = decodeArgs(['bytes4', 'uint256'], data);
      return {
        code: 'ATTR_VIOLATES_RESTRICTION',
        name: 'AttributeViolatesRestriction',
        args: { selector: sel, restriction },
      };
    }
    case SEL.BundleAlreadyProcessed: {
      const [bundleHash] = decodeArgs(['bytes32'], data);
      return {
        code: 'BUNDLE_ALREADY_PROCESSED',
        name: 'BundleAlreadyProcessed',
        args: { bundleHash },
      };
    }
    case SEL.BundleVerifiedAlready: {
      const [bundleHash] = decodeArgs(['bytes32'], data);
      return {
        code: 'BUNDLE_ALREADY_VERIFIED',
        name: 'BundleVerifiedAlready',
        args: { bundleHash },
      };
    }
    case SEL.CallAlreadyExecuted: {
      const [bundleHash, callIndex] = decodeArgs(['bytes32', 'uint256'], data);
      return {
        code: 'CALL_ALREADY_EXECUTED',
        name: 'CallAlreadyExecuted',
        args: { bundleHash, callIndex },
      };
    }
    case SEL.CallNotExecutable: {
      const [bundleHash, callIndex] = decodeArgs(['bytes32', 'uint256'], data);
      return {
        code: 'CALL_NOT_EXECUTABLE',
        name: 'CallNotExecutable',
        args: { bundleHash, callIndex },
      };
    }
    case SEL.CanNotUnbundle: {
      const [bundleHash] = decodeArgs(['bytes32'], data);
      return { code: 'CANNOT_UNBUNDLE', name: 'CannotUnbundle', args: { bundleHash } };
    }
    case SEL.ExecutingNotAllowed: {
      const [bundleHash, callerAddress, executionAddress] = decodeArgs(
        ['bytes32', 'bytes', 'bytes'],
        data,
      );
      return {
        code: 'EXECUTING_NOT_ALLOWED',
        name: 'ExecutingNotAllowed',
        args: { bundleHash, callerAddress, executionAddress },
      };
    }
    case SEL.IndirectCallValueMismatch: {
      const [expected, actual] = decodeArgs(['uint256', 'uint256'], data);
      return {
        code: 'INDIRECT_CALL_VALUE_MISMATCH',
        name: 'IndirectCallValueMismatch',
        args: { expected, actual },
      };
    }
    case SEL.InteroperableAddressChainReferenceNotEmpty: {
      const [interoperableAddress] = decodeArgs(['bytes'], data);
      return {
        code: 'CHAIN_REFERENCE_NOT_EMPTY',
        name: 'InteroperableAddressChainReferenceNotEmpty',
        args: { interoperableAddress },
      };
    }
    case SEL.InteroperableAddressNotEmpty: {
      const [interoperableAddress] = decodeArgs(['bytes'], data);
      return {
        code: 'INTEROP_ADDRESS_NOT_EMPTY',
        name: 'InteroperableAddressNotEmpty',
        args: { interoperableAddress },
      };
    }
    case SEL.MessageNotIncluded:
      return { code: 'MESSAGE_NOT_INCLUDED', name: 'MessageNotIncluded' };
    case SEL.UnauthorizedMessageSender: {
      const [expected, actual] = decodeArgs(['address', 'address'], data);
      return {
        code: 'UNAUTHORIZED_MESSAGE_SENDER',
        name: 'UnauthorizedMessageSender',
        args: { expected, actual },
      };
    }
    case SEL.UnbundlingNotAllowed: {
      const [bundleHash, callerAddress, unbundlerAddress] = decodeArgs(
        ['bytes32', 'bytes', 'bytes'],
        data,
      );
      return {
        code: 'UNBUNDLING_NOT_ALLOWED',
        name: 'UnbundlingNotAllowed',
        args: { bundleHash, callerAddress, unbundlerAddress },
      };
    }
    case SEL.WrongCallStatusLength: {
      const [bundleCallsLength, providedCallStatusLength] = decodeArgs(
        ['uint256', 'uint256'],
        data,
      );
      return {
        code: 'WRONG_CALL_STATUS_LENGTH',
        name: 'WrongCallStatusLength',
        args: { bundleCallsLength, providedCallStatusLength },
      };
    }
    case SEL.WrongDestinationChainId: {
      const [bundleHash, expected, actual] = decodeArgs(['bytes32', 'uint256', 'uint256'], data);
      return {
        code: 'WRONG_DESTINATION_CHAIN_ID',
        name: 'WrongDestinationChainId',
        args: { bundleHash, expected, actual },
      };
    }
  }

  return { code: 'SEND_FAILED', name: 'UnknownRevert', args: { selector } };
}

export function interopErrorFromRevertData(
  data: Hex,
  cause?: unknown,
  context?: string,
): InteropError {
  const decoded = parseRevertData(data);
  if (decoded) {
    const msg = context ? `${context}: ${decoded.name}` : decoded.name;
    return new InteropError(decoded.code, msg, { decoded, revertData: data, cause });
  }
  return new InteropError(
    'SEND_FAILED',
    context ? `${context}: EVM call failed` : 'EVM call failed',
    { revertData: data, cause },
  );
}
