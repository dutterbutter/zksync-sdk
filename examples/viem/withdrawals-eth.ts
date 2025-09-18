// examples/viem/withdraw-eth.ts
import { createPublicClient, createWalletClient, http, parseEther, type Account, type Chain, type Transport } from 'viem';
import { privateKeyToAccount, nonceManager } from 'viem/accounts';

import { createViemClient } from '../../src/adapters/viem/client';
import { createViemSdk } from '../../src/adapters/viem/sdk';
import type { Address } from '../../src/core/types/primitives';
import { ETH_ADDRESS } from '../../src/core/constants';

const L1_RPC =
  'https://rpc.ankr.com/eth_sepolia/070715f5f3878124fc8e3b05fa7e5f8ec165ffc887f2ffd3a51c9e906681492c'; // e.g. https://sepolia.infura.io/v3/XXX
const L2_RPC = 'https://zksync-os-testnet-alpha.zksync.dev/'; // your L2 RPC
const PRIVATE_KEY = '0x3a86a76b2aee7d0742f2da930b3289cfcff31f57ffc923c672715ead32dc01a0';

async function main() {
  if (!PRIVATE_KEY || !PRIVATE_KEY.startsWith('0x') || PRIVATE_KEY.length !== 66) {
    throw new Error('Set your PRIVATE_KEY (0x-prefixed 32-byte) in env');
  }

  // --- Viem clients (explicit, same style as your deposit-eth-viem.ts) ---
  const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);

  const l1 = createPublicClient({ transport: http(L1_RPC) });
  const l2 = createPublicClient({ transport: http(L2_RPC) });

  const l1Wallet = createWalletClient<Transport, Chain, Account>({ account, transport: http(L1_RPC) });
  //const l2Wallet = createWalletClient<Transport, Chain, Account>({ account, transport: http(L2_RPC) });

  // --- SDK client: pass explicit clients + wallets ---
  // (ensure your createViemClient supports { l1, l2, l1Wallet, l2Wallet })
  const client = createViemClient({ l1, l2, l1Wallet });
  const sdk = createViemSdk(client);

  const me = account.address as Address;

  // Withdraw ETH (base token on L2)
  const params = {
    token: ETH_ADDRESS,
    amount: parseEther('0.01'),
    to: me,
    // l2GasLimit: 300_000n, // optional
  } as const;

  // Quote (dry run)
  const quote = await sdk.withdrawals.quote(params);
  console.log('QUOTE:', quote);

  // Prepare (no sends)
  const plan = await sdk.withdrawals.prepare(params);
  console.log('PREPARE:', plan);

  // Create (send L2 withdraw)
  const created = await sdk.withdrawals.create(params);
  console.log('CREATE:', created);

  // Quick status
  console.log('STATUS (initial):', await sdk.withdrawals.status(created.l2TxHash));

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

  // Wait until ready to finalize (no side-effects)
  await sdk.withdrawals.wait(created.l2TxHash, { for: 'ready' });
  console.log('STATUS (ready):', await sdk.withdrawals.status(created.l2TxHash));

  // Try to finalize on L1 (idempotent)
  const fin = await sdk.withdrawals.tryFinalize(created.l2TxHash);
  console.log('TRY FINALIZE:', fin);

  // Optionally wait until finalized mapping is true (may return L1 receipt if we submitted it)
  const l1Receipt = await sdk.withdrawals.wait(created.l2TxHash, { for: 'finalized' });
  if (l1Receipt) {
    console.log('L1 finalize receipt:', l1Receipt.transactionHash);
  } else {
    console.log('Finalized (no local L1 receipt — possibly finalized by someone else).');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
