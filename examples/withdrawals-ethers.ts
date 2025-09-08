// examples/withdraw-eth.ts
import { JsonRpcProvider, Wallet, parseEther } from 'ethers';
import { createEthersClient } from '../src/adapters/ethers/client';
import { createEthersSdk } from '../src/adapters/ethers/kit';
import type { Address } from '../src/core/types/primitives';

//const L1_RPC = "https://sepolia.infura.io/v3/07e4434e9ba24cd68305123037336417";                     // e.g. https://sepolia.infura.io/v3/XXX
// const L1_RPC =
//   'https://rpc.ankr.com/eth_sepolia/070715f5f3878124fc8e3b05fa7e5f8ec165ffc887f2ffd3a51c9e906681492c';
// const L2_RPC = 'https://zksync-os-stage-api.zksync-nodes.com'; // your L2 RPC
// const PRIVATE_KEY = '0x3a86a76b2aee7d0742f2da930b3289cfcff31f57ffc923c672715ead32dc01a0';

const L1_RPC = 'http://localhost:8545'; // e.g. https://sepolia.infura.io/v3/XXX
const L2_RPC = 'http://localhost:3050'; // your L2 RPC
const PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

// ETH sentinel (same one used in your types/primitives)
const L2_ETH_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

async function main() {
  // 1) Providers + signer
  const l1 = new JsonRpcProvider(L1_RPC);
  const l2 = new JsonRpcProvider(L2_RPC);
  const signer = new Wallet(PRIVATE_KEY, l1);

  // 2) Client + SDK
  const client = createEthersClient({ l1, l2, signer });
  const sdk = createEthersSdk(client);

  const me = (await signer.getAddress()) as Address;

  // 3) Withdraw params (ETH path only)
  const params = {
    token: L2_ETH_ADDRESS,
    amount: parseEther('0.017'), // 0.001 ETH
    to: me, // L1 receiver (defaults to sender if omitted)
    // l2GasLimit: 300_000n,      // optional override
  } as const;

  // 4) Quote (dry-run only)
  const quote = await sdk.withdrawals.quote(params);
  console.log('QUOTE:', quote);

  // 5) Create (sends approve if needed + withdraw call on L2)
  const handle = await sdk.withdrawals.create(params);
  console.log('Withdrawal handle:', handle);
  console.log('L2 withdraw tx hash:', handle.l2TxHash);

  // 6) Wait for L2 inclusion
  const l2Receipt = await sdk.withdrawals.wait(handle, { for: 'l2' });
  console.log('L2 receipt:', l2Receipt?.hash);

  // Optional: later you can also add wait({for:"l1"}) or {for:"finalized"}
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
