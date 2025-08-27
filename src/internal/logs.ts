import { keccak_256 } from '@noble/hashes/sha3';
import type { Address, Hex } from '../types/primitives';
import { add0x, strip0x } from './abi';

export type RawLog = {
  address?: Address;
  topics: readonly Hex[];
  data: Hex;
};

export function eventTopic0(signature: string): Hex {
  const bytes = new TextEncoder().encode(signature);
  return add0x(Buffer.from(keccak_256(bytes)).toString('hex'));
}

export function filterLogs(
  logs: readonly RawLog[],
  opts: { address?: Address; topic0?: Hex },
): RawLog[] {
  return logs.filter((l) => {
    if (opts.address && l.address && l.address.toLowerCase() !== opts.address.toLowerCase())
      return false;
    if (
      opts.topic0 &&
      (!l.topics.length || l.topics[0].toLowerCase() !== opts.topic0.toLowerCase())
    )
      return false;
    return true;
  });
}

// Basic decoders for 32-byte words (used later if needed)
export function wordAt(data: Hex, index: number): Hex {
  const s = strip0x(data);
  return add0x(s.slice(index * 64, (index + 1) * 64));
}
export function decodeAddress(word: Hex): Address {
  const s = strip0x(word);
  return add0x(s.slice(24 * 2));
}
export function decodeUint(word: Hex): bigint {
  return BigInt(word);
}
