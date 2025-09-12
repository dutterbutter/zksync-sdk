/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Interface, type JsonFragment } from 'ethers';
import IL1NullifierABI from '../../../internal/abis/IL1Nullifier.json' assert { type: 'json' };
import IL1NativeTokenVaultABI from '../../../internal/abis/L1NativeTokenVault.json' assert { type: 'json' };
import IL2NativeTokenVaultABI from '../../../internal/abis/L2NativeTokenVault.json' assert { type: 'json' };
import IERC20ABI from '../../../internal/abis/IERC20.json' assert { type: 'json' };
import { REVERT_TO_READINESS } from '../../../core/errors/withdrawal-revert-map';
import type { FinalizeReadiness } from '../../../core/types/flows/withdrawals';

export interface DecodedRevert {
  selector: `0x${string}`;
  /** Decoded Solidity error name */
  name?: string;
  /** Decoded args from parseError */
  args?: unknown[];
  /** Optional labels if we know the contract/function context */
  contract?: string;
  fn?: string;
}

// ---- Internal registry of Interfaces --------------

/**
 * Minimal, global registry of Interfaces for decode.
 * Keep this list small & focused on contracts we actually call.
 */
const ERROR_IFACES: { name: string; iface: Interface }[] = [];

/** Standard built-ins we *always* try */
const IFACE_ERROR_STRING = new Interface(['error Error(string)']);
const IFACE_PANIC = new Interface(['error Panic(uint256)']);

(function bootstrapDefaultIfaces() {
  try {
    ERROR_IFACES.push({
      name: 'IL1Nullifier',
      iface: new Interface(IL1NullifierABI as JsonFragment[]),
    });
  } catch {
    // ignore
  }
  try {
    ERROR_IFACES.push({ name: 'IERC20', iface: new Interface(IERC20ABI as JsonFragment[]) });
  } catch {
    // ignore
  }
  try {
    ERROR_IFACES.push({
      name: 'IL1NativeTokenVault',
      iface: new Interface(IL1NativeTokenVaultABI as JsonFragment[]),
    });
  } catch {
    // ignore
  }
  try {
    ERROR_IFACES.push({
      name: 'IL2NativeTokenVault',
      iface: new Interface(IL2NativeTokenVaultABI as JsonFragment[]),
    });
  } catch {
    // ignore
  }
})();

// ---- Public API -------------------------------------------------------------

/**
 * Allow callers to extend the error-decode registry at runtime.
 */
export function registerErrorAbi(name: string, abi: ReadonlyArray<JsonFragment>) {
  const existing = ERROR_IFACES.findIndex((x) => x.name === name);
  const entry = { name, iface: new Interface(abi as JsonFragment[]) };
  if (existing >= 0) ERROR_IFACES[existing] = entry;
  else ERROR_IFACES.push(entry);
}

/**
 * Extract revert data.
 */
function extractRevertData(e: any): string | undefined {
  const maybe =
    e?.data?.data ?? e?.error?.data ?? e?.data ?? e?.error?.error?.data ?? e?.info?.error?.data;

  if (typeof maybe === 'string' && maybe.startsWith('0x') && maybe.length >= 10) {
    return maybe;
  }
  return undefined;
}

/**
 * Zero-arg decoder: tries standard Error(string)/Panic(uint256) first,
 * then all registered Interfaces (IL1Nullifier, IERC20, etc.).
 *
 * Returns `undefined` if no revert data detected. Otherwise returns at least { selector }.
 */
export function decodeRevert(e: any): DecodedRevert | undefined {
  const data = extractRevertData(e);
  if (!data) return;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const selector = `0x${data.slice(2, 10)}` as `0x${string}`;

  // Try Error(string)
  try {
    const parsed = IFACE_ERROR_STRING.parseError(data);
    if (parsed?.name === 'Error') {
      const args = parsed.args ? Array.from(parsed.args) : undefined;
      return { selector, name: 'Error', args };
    }
  } catch {
    // keep trying
  }

  // Try Panic(uint256)
  try {
    const parsed = IFACE_PANIC.parseError(data);
    if (parsed?.name === 'Panic') {
      const args = parsed.args ? Array.from(parsed.args) : undefined;
      return { selector, name: 'Panic', args };
    }
  } catch {
    // keep trying
  }

  // Try all registered ABIs
  for (const { name, iface } of ERROR_IFACES) {
    try {
      const parsed = iface.parseError(data);
      if (parsed) {
        const args = parsed.args ? Array.from(parsed.args) : undefined;
        return {
          selector,
          name: parsed.name,
          args,
          contract: name,
        };
      }
    } catch {
      // keep trying
    }
  }

  // Fallback
  return { selector };
}

/** Classify finalizeDeposit readiness from revert error.
 *
 * Uses both the decoded revert name (if any) and also does some
 * heuristic string-matching on the error message to catch "paused" etc.
 */
export function classifyReadinessFromRevert(e: unknown): FinalizeReadiness {
  const r = decodeRevert(e);
  const name = r?.name;

  if (name && REVERT_TO_READINESS[name]) return REVERT_TO_READINESS[name];

  const msg = (typeof e === 'object' && e && ((e as any).shortMessage || (e as any).message)) || '';
  const lower = String(msg).toLowerCase();
  if (lower.includes('paused')) return { kind: 'NOT_READY', reason: 'paused' };

  if (name || r?.selector) {
    return { kind: 'UNFINALIZABLE', reason: 'unsupported', detail: name ?? r?.selector };
  }

  // Fallback
  return { kind: 'NOT_READY', reason: 'unknown', detail: lower || undefined };
}
