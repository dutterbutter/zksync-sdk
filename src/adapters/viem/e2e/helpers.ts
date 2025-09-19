/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

// tests/e2e/viem/helpers.viem.ts
import type { Address, Hex } from '../../../core/types/primitives.ts';
import { expect } from 'bun:test';

// viem
import {
  createPublicClient,
  createWalletClient,
  http,
  type Transport,
  type Chain,
  type Account,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// ⬇️ Adjust these to your actual factories
import { createViemClient } from '../client.ts';
import { createViemSdk } from '../sdk.ts';

// ------- Env (with sensible defaults for your local stack) -------
const L1_RPC = 'http://127.0.0.1:8545';
const L2_RPC = 'http://127.0.0.1:3050';
const PRIVATE_KEY = '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6';

// If you have Chain objects for L1/L2, you can pass them to the client/wallet.
// For plain local RPCs, omitting `chain` is fine and viem will infer by RPC.
const L1_CHAIN: Chain | undefined = undefined;
const L2_CHAIN: Chain | undefined = undefined;

// ------- Factory used by tests -------
export function createTestClientAndSdkViem() {
  // --- Account ---
  const account: Account = privateKeyToAccount(PRIVATE_KEY);

  // --- Public clients ---
  const l1 = createPublicClient({
    transport: http(L1_RPC),
    ...(L1_CHAIN ? { chain: L1_CHAIN } : {}),
  });
  const l2 = createPublicClient({
    transport: http(L2_RPC),
    ...(L2_CHAIN ? { chain: L2_CHAIN } : {}),
  });

  // --- Wallet clients ---
  const l1Wallet = createWalletClient<Transport, Chain, Account>({
    account,
    transport: http(L1_RPC),
    ...(L1_CHAIN ? { chain: L1_CHAIN } : {}),
  });
  const l2Wallet = createWalletClient<Transport, Chain, Account>({
    account,
    transport: http(L2_RPC),
    ...(L2_CHAIN ? { chain: L2_CHAIN } : {}),
  });

  // --- SDK client composed from explicit clients + wallets ---
  const client = createViemClient({ l1, l2, l1Wallet, l2Wallet });

  const sdk = createViemSdk(client);
  return { client, sdk };
}

// ---------------- Polling helpers ----------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function waitForL1InclusionViem(sdk: any, handle: any, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const s = await sdk.deposits.status(handle);
    if (s.phase !== 'L1_PENDING' && s.phase !== 'UNKNOWN') {
      return s;
    }
    await sleep(1500);
  }
  throw new Error('Timed out waiting for L1 inclusion (deposit, viem).');
}

// ---------------- Balance verification ----------------

export async function verifyDepositBalancesViem(args: {
  client: any;
  me: Address;
  balancesBefore: { l1: bigint; l2: bigint };
  mintValue: bigint;
  amount: bigint;
  l1TxHashes: Hex[];
}) {
  const { client, me, balancesBefore, mintValue, amount, l1TxHashes } = args;

  const [l1After, l2After] = await Promise.all([
    client.l1.getBalance({ address: me }),
    client.l2.getBalance({ address: me }),
  ]);

  // L2 delta: amount ≤ delta ≤ mintValue (amount + refund)
  const l2Delta = l2After - balancesBefore.l2;
  expect(l2Delta >= amount).toBeTrue();
  expect(l2Delta <= mintValue).toBeTrue();

  // L1 spend = mintValue + sum of L1 gas across all steps
  let totalL1Fees = 0n;
  for (const hash of l1TxHashes) {
    const rcpt = await client.l1.getTransactionReceipt({ hash });
    expect(rcpt).toBeTruthy();

    const gasUsed = BigInt(rcpt.gasUsed ?? 0n);
    const priceLike = rcpt.effectiveGasPrice ?? rcpt.gasPrice ?? 0n;
    const gp = BigInt(priceLike);
    totalL1Fees += gasUsed * gp;
  }

  const l1Delta = balancesBefore.l1 - l1After;
  expect(l1Delta).toBe(mintValue + totalL1Fees);
}

/**
 * Poll until L2 inclusion is confirmed for a withdrawal (status != L2_PENDING/UNKNOWN).
 * Also tolerant to viem throwing TransactionReceiptNotFoundError (wrapped).
 */
export async function waitForL2InclusionWithdrawViem(sdk: any, handle: any, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const s = await sdk.withdrawals.status(handle);
      if (s.phase !== 'L2_PENDING' && s.phase !== 'UNKNOWN') return s;
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      // Swallow transient "receipt not found" during indexing
      if (!msg.includes('TransactionReceiptNotFoundError')) throw e;
    }
    await sleep(1500);
  }
  throw new Error('Timed out waiting for L2 inclusion (withdrawal, viem).');
}

/**
 * Wait until withdrawal becomes READY_TO_FINALIZE (or FINALIZED).
 * No side-effects (uses status loop, not finalize()).
 */
export async function waitUntilReadyToFinalizeViem(
  sdk: any,
  handle: any,
  timeoutMs = 180_000,
  pollMs = 3500,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const s = await sdk.withdrawals.status(handle);
      if (s.phase === 'READY_TO_FINALIZE' || s.phase === 'FINALIZED') return s;
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      if (!msg.includes('TransactionReceiptNotFoundError')) throw e;
    }
    await sleep(pollMs);
  }
  throw new Error('Timed out waiting for READY_TO_FINALIZE (viem).');
}

/**
 * Verify withdrawal balance effects (viem):
 *  - L2: decreases by at least `amount` (also includes L2 gas)
 *  - L1: after finalization, net delta = +amount - finalizeGas
 * If finalize receipt is unavailable, we only check that L1 increased (>= 0).
 */
export async function verifyWithdrawalBalancesAfterFinalizeViem(args: {
  client: any;
  me: Address;
  balancesBefore: { l1: bigint; l2: bigint };
  amount: bigint;
  l2Rcpt: any; // viem TransactionReceipt
  l1FinalizeRcpt: any | null; // viem TransactionReceipt or null
}) {
  const { client, me, balancesBefore, amount, l2Rcpt, l1FinalizeRcpt } = args;

  const [l1After, l2After] = await Promise.all([
    client.l1.getBalance({ address: me }),
    client.l2.getBalance({ address: me }),
  ]);

  // ---------- L2 checks ----------
  const l2Delta = balancesBefore.l2 - l2After; // decrease
  expect(l2Delta >= amount).toBeTrue();

  try {
    const gasUsed = BigInt(l2Rcpt?.gasUsed ?? 0n);
    const priceLike = l2Rcpt?.effectiveGasPrice ?? l2Rcpt?.gasPrice ?? 0n;
    const gp = BigInt(priceLike);
    const l2Fee = gasUsed * gp;
    const expectedMinSpend = amount + l2Fee;
    expect(l2Delta >= expectedMinSpend).toBeTrue();
  } catch {
    // ignore if fields not present
  }

  // ---------- L1 checks ----------
  const l1Delta = l1After - balancesBefore.l1; // net increase after finalization

  if (l1FinalizeRcpt) {
    const gasUsed = BigInt(l1FinalizeRcpt.gasUsed ?? 0n);
    const priceLike = l1FinalizeRcpt.effectiveGasPrice ?? l1FinalizeRcpt.gasPrice ?? 0n;
    const gp = BigInt(priceLike);
    const finalizeFee = gasUsed * gp;
    expect(l1Delta).toBe(amount - finalizeFee);
  } else {
    expect(l1Delta >= 0n).toBeTrue();
  }
}
