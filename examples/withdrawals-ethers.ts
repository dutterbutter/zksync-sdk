// examples/withdraw-eth.ts
import { JsonRpcProvider, Wallet, parseEther } from 'ethers';
import { createEthersClient } from '../src/adapters/ethers/client';
import { createEthersSdk } from '../src/adapters/ethers/sdk';
import type { Address } from '../src/core/types/primitives';
import { ETH_ADDRESS } from '../src/core/constants';

//const L1_RPC = "https://sepolia.infura.io/v3/07e4434e9ba24cd68305123037336417";                     // e.g. https://sepolia.infura.io/v3/XXX
// const L1_RPC =
//   'https://rpc.ankr.com/eth_sepolia/070715f5f3878124fc8e3b05fa7e5f8ec165ffc887f2ffd3a51c9e906681492c';
// const L2_RPC = 'https://zksync-os-stage-api.zksync-nodes.com'; // your L2 RPC
// const PRIVATE_KEY = '0x3a86a76b2aee7d0742f2da930b3289cfcff31f57ffc923c672715ead32dc01a0';

const L1_RPC = 'http://localhost:8545';
const L2_RPC = 'http://localhost:3050';
const PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

async function main() {
  const l1 = new JsonRpcProvider(L1_RPC);
  const l2 = new JsonRpcProvider(L2_RPC);
  const signer = new Wallet(PRIVATE_KEY, l1);

  const client = createEthersClient({ l1, l2, signer });
  const sdk = createEthersSdk(client);

  const me = (await signer.getAddress()) as Address;

  // Withdraw params (ETH path only)
  const params = {
    token: ETH_ADDRESS,
    amount: parseEther('0.017'), // 0.001 ETH
    to: me,
    // l2GasLimit: 300_000n,
  } as const;

  // Quote (dry-run only)

  const tryQuote = await sdk.withdrawals.tryQuote(params);
  console.log('TRY QUOTE: ', tryQuote);

  const quote = await sdk.withdrawals.quote(params);
  console.log('QUOTE: ', quote);

  const tryPrepare = await sdk.withdrawals.tryPrepare(params);
  console.log('TRY PREPARE: ', tryPrepare);

  const prepare = await sdk.withdrawals.prepare(params);
  console.log('PREPARE: ', prepare);

  const created = await sdk.withdrawals.create(params);
  console.log('CREATE:', created);

  // Quick status probe
  console.log('STATUS (initial):', await sdk.withdrawals.status(created.l2TxHash));

  // -------- Phase 1: wait for L2 inclusion --------
  const l2Receipt = await sdk.withdrawals.wait(created, { for: 'l2' });
  console.log(
    'L2 included: block=',
    l2Receipt?.blockNumber,
    'status=',
    l2Receipt?.status,
    'hash=',
    l2Receipt?.hash,
  );

  // Optional: check status again
  console.log('STATUS (post-L2):', await sdk.withdrawals.status(created.l2TxHash));

  // -------- Phase 2: wait until ready to finalize (no side-effects) --------
  await sdk.withdrawals.wait(created.l2TxHash, { for: 'ready' });
  console.log('STATUS (ready):', await sdk.withdrawals.status(created.l2TxHash));

  // -------- Phase 3: finalize on L1 (idempotent) --------
  // Use tryFinalize to avoid throwing in an example script
  const fin = await sdk.withdrawals.tryFinalize(created.l2TxHash);
  if (!fin.ok) {
    console.error('FINALIZE failed:', fin.error);
    return;
  }
  console.log('FINALIZE status:', fin.value.status);

  // -------- Phase 4: optionally wait until finalized mapping is true --------
  // If *we* submitted the L1 finalize tx in this process, this may return the L1 receipt.
  const l1Receipt = await sdk.withdrawals.wait(created.l2TxHash, { for: 'finalized' });
  if (l1Receipt) {
    console.log('L1 finalize receipt:', l1Receipt.hash);
  } else {
    console.log('Finalized (no local L1 receipt available, possibly finalized by another actor).');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
