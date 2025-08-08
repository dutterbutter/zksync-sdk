// packages/core/src/internal/evm.ts
import { bytesToHex } from './hex';
import type { Hex } from './hex';
import { pad32, u256Bytes } from './bytes';

/** 20-byte address -> 32-byte left-padded */
export function addrBytes(addr: Hex): Uint8Array {
  const hex = addr.toLowerCase().replace(/^0x/, '');
  if (hex.length !== 40) throw new Error('bad address');
  const raw = new Uint8Array(20).map((_, i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16)); // fast path
  return pad32(raw);
}

/** abi.encode(uint256 amount, address receiver, address token) — L2 router burn data */
export function encodeBridgeBurnData(amount: bigint, receiver: Hex, token: Hex): Hex {
  const body = new Uint8Array([...u256Bytes(amount), ...addrBytes(receiver), ...addrBytes(token)]);
  return bytesToHex(body);
}

/** Minimal ERC-20 transfer calldata. selector=0xa9059cbb */
export function erc20TransferCalldata(to: Hex, amount: bigint): Hex {
  const selector = 'a9059cbb';
  const toPadded = to.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const amountHex = amount.toString(16).padStart(64, '0');
  return `0x${selector}${toPadded}${amountHex}` as Hex;
}
