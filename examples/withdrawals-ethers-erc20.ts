// examples/withdraw-eth.ts
// import { Interface, JsonRpcProvider, Wallet, parseUnits } from 'ethers';
// import { createEthersClient } from '../src/adapters/ethers/client';
// import { createEthersSdk } from '../src/adapters/ethers/kit';
// import type { Address } from '../src/types/primitives';

// import { TransactionReceiptZKsyncOS } from '../src/adapters/ethers/resources/withdrawals/routes/types';

// const L1_RPC = "https://sepolia.infura.io/v3/07e4434e9ba24cd68305123037336417";                     // e.g. https://sepolia.infura.io/v3/XXX
// const L1_RPC = "https://rpc.ankr.com/eth_sepolia/070715f5f3878124fc8e3b05fa7e5f8ec165ffc887f2ffd3a51c9e906681492c"
// const L2_RPC = "https://zksync-os-stage-api.zksync-nodes.com";                     // your L2 RPC
// const PRIVATE_KEY = "0x3a86a76b2aee7d0742f2da930b3289cfcff31f57ffc923c672715ead32dc01a0";

// constants
// import { Contract } from 'ethers';
// import {
//   L2_ASSET_ROUTER_ADDR,
//   L2_NATIVE_TOKEN_VAULT_ADDR,
// } from '../src/adapters/ethers/resources/utils';

const L1_RPC = 'http://localhost:8545'; // e.g. https://sepolia.infura.io/v3/XXX
const L2_RPC = 'http://localhost:3050'; // your L2 RPC
const PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

import { Interface, JsonRpcProvider, Wallet, parseUnits } from 'ethers';
import { createEthersClient } from '../src/adapters/ethers/client';
import { createEthersSdk } from '../src/adapters/ethers/sdk';
import type { Address } from '../src/core/types/primitives';

import { Contract } from 'ethers';
import { L2_NATIVE_TOKEN_VAULT_ADDR } from '../src/core/constants';

import { TransactionReceiptZKsyncOS } from '../src/adapters/ethers/resources/withdrawals/routes/types';

import IBridgehubABI from '../src/internal/abis/IBridgehub.json' assert { type: 'json' };
import IL1AssetRouterABI from '../src/internal/abis/IL1AssetRouter.json' assert { type: 'json' };
import IL1NativeTokenVaultABI from '../src/internal/abis/L1NativeTokenVault.json' assert { type: 'json' };
import L2NativeTokenVaultABI from '../src/internal/abis/L2NativeTokenVault.json' assert { type: 'json' };
import IERC20ABI from '../src/internal/abis/IERC20.json' assert { type: 'json' };
import { sleep } from 'bun';

// Replace with a real **L2 ERC-20 token address** you hold on L2
const L1_ERC20_TOKEN = '0x71C95911E9a5D330f4D621842EC243EE1343292e' as Address;

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

  // Wait until the withdrawal is ready to finalize (no side-effects)
  await sdk.withdrawals.wait(created.l2TxHash, { for: 'ready' });
  console.log('STATUS (ready):', await sdk.withdrawals.status(created.l2TxHash));

  // Finalize on L1 (idempotent)
  const fin = await sdk.withdrawals.tryFinalize(created.l2TxHash);
  if (!fin.ok) {
    console.error('FINALIZE failed:', fin.error);
    return;
  }
  console.log('FINALIZE status:', fin.value.status, fin.value.receipt?.hash ?? '(already finalized)');

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
