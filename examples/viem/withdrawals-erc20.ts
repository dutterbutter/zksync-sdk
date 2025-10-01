// examples/withdraw-erc20.ts
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  type Account,
  type Chain,
  type Transport,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { createViemClient } from '../../src/adapters/viem/client';
import { createViemSdk } from '../../src/adapters/viem/sdk';
import type { Address } from '../../src/core/types/primitives';
import { IERC20ABI } from '../../src/core/internal/abi-registry';

const L1_RPC = 'http://localhost:8545'; // e.g. https://sepolia.infura.io/v3/XXX
const L2_RPC = 'http://localhost:3050'; // your L2 RPC
const PRIVATE_KEY =
  process.env.PRIVATE_KEY || '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

// Replace with a real **L1 ERC-20 token address** you hold on L2
const L1_ERC20_TOKEN = '0x8464135c8F25Da09e49BC8782676a84730C318bC' as Address;

async function main() {
  if (!PRIVATE_KEY) {
    throw new Error('Set PRIVATE_KEY (0x-prefixed) in your environment.');
  }

  // --- Viem clients ---
  const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
  const l1 = createPublicClient({ transport: http(L1_RPC) });
  const l2 = createPublicClient({ transport: http(L2_RPC) });

  const l1Wallet: WalletClient<Transport, Chain, Account> = createWalletClient({
    account,
    transport: http(L1_RPC),
  });
  // Need to provide an L2 wallet client for sending L2 tx
  const l2Wallet = createWalletClient<Transport, Chain, Account>({
    account,
    transport: http(L2_RPC),
  });
  const client = createViemClient({ l1, l2, l1Wallet, l2Wallet });
  const sdk = createViemSdk(client);

  const me = account.address as Address;

  // Resolve the L2-mapped token for an L1 ERC-20
  const l2Token = await sdk.helpers.l2TokenAddress(L1_ERC20_TOKEN);

  const [sym, dec] = await Promise.all([
    l2.readContract({
      address: l2Token,
      abi: IERC20ABI,
      functionName: 'symbol',
    }) as Promise<string>,
    l2.readContract({
      address: l2Token,
      abi: IERC20ABI,
      functionName: 'decimals',
    }) as Promise<number>,
  ]);

  // Balances (before)
  const [balL1Before, balL2Before] = await Promise.all([
    l1.readContract({
      address: L1_ERC20_TOKEN,
      abi: IERC20ABI,
      functionName: 'balanceOf',
      args: [me],
    }) as Promise<bigint>,
    l2.readContract({
      address: l2Token,
      abi: IERC20ABI,
      functionName: 'balanceOf',
      args: [me],
    }) as Promise<bigint>,
  ]);
  console.log(`[${sym}] balances before  L1=${balL1Before}  L2=${balL2Before}`);

  // Withdraw params
  const params = {
    token: l2Token,
    amount: parseUnits('25', dec), // withdraw 25 tokens
    to: me,
    // l2GasLimit: 300_000n,
  } as const;

  // -------- Dry runs / planning --------
  console.log('TRY QUOTE:', await sdk.withdrawals.tryQuote(params));
  console.log('QUOTE:', await sdk.withdrawals.quote(params));
  console.log('TRY PREPARE:', await sdk.withdrawals.tryPrepare(params));
  console.log('PREPARE:', await sdk.withdrawals.prepare(params));

  // -------- Create (L2 approvals if needed + withdraw) --------
  const created = await sdk.withdrawals.create(params);
  console.log('CREATE:', created);

  // Wait for L2 inclusion
  const l2Receipt = await sdk.withdrawals.wait(created, { for: 'l2' });
  console.log(
    'L2 included: block=',
    l2Receipt?.blockNumber,
    'status=',
    l2Receipt?.status,
    'hash=',
    l2Receipt?.transactionHash,
  );

  console.log('STATUS (post-L2):', await sdk.withdrawals.status(created.l2TxHash));

  // Wait until the withdrawal is ready to finalize
  await sdk.withdrawals.wait(created.l2TxHash, { for: 'ready' });
  console.log('STATUS (ready):', await sdk.withdrawals.status(created.l2TxHash));

  // Finalize on L1
  const fin = await sdk.withdrawals.tryFinalize(created.l2TxHash);
  console.log(
    'FINALIZE:',
    fin.ok ? fin.value.status : fin.error,
    fin.ok ? (fin.value.receipt?.transactionHash ?? '(already finalized)') : '',
  );

  const l1Receipt = await sdk.withdrawals.wait(created.l2TxHash, { for: 'finalized' });
  if (l1Receipt) {
    console.log('L1 finalize receipt:', l1Receipt.transactionHash);
  } else {
    console.log('Finalized (no local L1 receipt available, possibly finalized by another actor).');
  }

  // Balances (after)
  const [balL1After, balL2After] = await Promise.all([
    l1.readContract({
      address: L1_ERC20_TOKEN,
      abi: IERC20ABI,
      functionName: 'balanceOf',
      args: [me],
    }) as Promise<bigint>,
    l2.readContract({
      address: l2Token,
      abi: IERC20ABI,
      functionName: 'balanceOf',
      args: [me],
    }) as Promise<bigint>,
  ]);
  console.log(`[${sym}] balances after   L1=${balL1After}  L2=${balL2After}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
