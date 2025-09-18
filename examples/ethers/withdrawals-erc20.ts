import { JsonRpcProvider, Wallet, parseUnits } from 'ethers';
import { createEthersClient } from '../../src/adapters/ethers/client';
import { createEthersSdk } from '../../src/adapters/ethers/sdk';
import type { Address } from '../../src/core/types/primitives';

import { Contract } from 'ethers';
import IERC20ABI from '../../src/internal/abis/IERC20.json' assert { type: 'json' };

const L1_RPC = 'http://localhost:8545'; // e.g. https://sepolia.infura.io/v3/XXX
const L2_RPC = 'http://localhost:3050'; // your L2 RPC
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';

// Replace with a real **L2 ERC-20 token address** you hold on L2
const L1_ERC20_TOKEN = '0x42E331a2613Fd3a5bc18b47AE3F01e1537fD8873' as Address;

async function main() {
  const l1 = new JsonRpcProvider(L1_RPC);
  const l2 = new JsonRpcProvider(L2_RPC);
  const signer = new Wallet(PRIVATE_KEY, l1);

  const client = createEthersClient({ l1, l2, signer });
  const sdk = createEthersSdk(client);

  const me = (await signer.getAddress()) as Address;
  const l2Token = await sdk.helpers.l2TokenAddress(L1_ERC20_TOKEN);

  const erc20L1 = new Contract(L1_ERC20_TOKEN, IERC20ABI, l1);
  const erc20L2 = new Contract(l2Token, IERC20ABI, l2);
  const [sym, dec] = await Promise.all([erc20L2.symbol(), erc20L2.decimals()]);

  // Balances before
  const [balL1Before, balL2Before] = await Promise.all([
    erc20L1.balanceOf(me),
    erc20L2.balanceOf(me),
  ]);
  console.log(`[${sym}] balances before  L1=${balL1Before}  L2=${balL2Before}`);

  // Prepare withdraw params (ERC-20 route uses L2 token address)
  const params = {
    token: l2Token, // L2 ERC-20
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
    l2Receipt?.hash,
  );

  console.log('STATUS (ready):', await sdk.withdrawals.status(created.l2TxHash));

  // Wait until the withdrawal is ready to finalize (no side-effects)
  await sdk.withdrawals.wait(created.l2TxHash, { for: 'ready' });

  // Finalize on L1 (idempotent)
  const fin = await sdk.withdrawals.tryFinalize(created.l2TxHash);
  if (!fin.ok) {
    console.error('FINALIZE failed:', fin.error);
    return;
  }
  console.log(
    'FINALIZE status:',
    fin.value.status,
    fin.value.receipt?.hash ?? '(already finalized)',
  );

  // Optionally: wait until finalized mapping is true and fetch our L1 receipt if we sent it
  const l1Receipt = await sdk.withdrawals.wait(created.l2TxHash, { for: 'finalized' });
  if (l1Receipt) {
    console.log('L1 finalize receipt:', l1Receipt.hash);
  } else {
    console.log('Finalized (no local L1 receipt available, possibly finalized by another actor).');
  }

  // Balances after (useful when finalize just happened)
  const [balL1After, balL2After] = await Promise.all([
    erc20L1.balanceOf(me),
    erc20L2.balanceOf(me),
  ]);
  console.log(`[${sym}] balances after   L1=${balL1After}  L2=${balL2After}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
