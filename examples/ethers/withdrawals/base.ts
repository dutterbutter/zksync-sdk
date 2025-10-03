// examples/ethers/withdrawals/eth-base.ts
/**
 * Example: Withdraw BASE token from an BASE token L2
 *
 * Notes:
 * - Use the L2 base-token system address (0x...800A) as `token`.
 * - Route: `base` → L2 BaseTokenSystem.withdraw(to).
 *
 * Flow:
 * 1) Connect to L1 + L2 RPCs and create Ethers SDK client.
 * 2) Call `sdk.withdrawals.quote` to estimate.
 * 3) Call `sdk.withdrawals.prepare` to build the plan.
 * 4) Call `sdk.withdrawals.create` to send the L2 withdraw.
 * 5) Track with `sdk.withdrawals.status` and `sdk.withdrawals.wait`:
 *      - wait(..., { for: 'l2' })       → L2 inclusion
 *      - wait(..., { for: 'ready' })    → ready to finalize
 *      - tryFinalize(...)                → submit L1 finalize (if needed)
 *      - wait(..., { for: 'finalized' })→ finalized on L1
 */

import { JsonRpcProvider, Wallet, parseEther } from 'ethers';
import { createEthersClient } from '../../../src/adapters/ethers/client';
import { createEthersSdk } from '../../../src/adapters/ethers/sdk';
import type { Address } from '../../../src/core/types/primitives';
import { L2_BASE_TOKEN_ADDRESS } from '../../../src/core/constants';

const L1_RPC =
  'https://rpc.ankr.com/eth_sepolia/070715f5f3878124fc8e3b05fa7e5f8ec165ffc887f2ffd3a51c9e906681492c'; // e.g. https://sepolia.infura.io/v3/XXX
const L2_RPC = 'https://zksync-os-testnet-sophon.zksync.dev'; // your L2 RPC
const PRIVATE_KEY =
  process.env.PRIVATE_KEY || '0x4d908585a4106c79dd3084fd49e0e0ac6003421396bce482824b7380b3db62dd';

async function main() {
  if (!PRIVATE_KEY) throw new Error('Set your PRIVATE_KEY in the environment');

  const l1 = new JsonRpcProvider(L1_RPC);
  const l2 = new JsonRpcProvider(L2_RPC);
  const signer = new Wallet(PRIVATE_KEY, l1);

  const client = await createEthersClient({ l1, l2, signer });
  const sdk = createEthersSdk(client);

  const me = (await signer.getAddress()) as Address;

  const params = {
    token: L2_BASE_TOKEN_ADDRESS, // BASE token on this chain
    amount: parseEther('1'),
    to: me,
    // l2GasLimit?: 300_000n, fee overrides, etc...
  } as const;

  const quote = await sdk.withdrawals.quote(params);
  console.log('QUOTE:', quote);

  const prepared = await sdk.withdrawals.prepare(params);
  console.log('PREPARE:', prepared);

  const created = await sdk.withdrawals.create(params);
  console.log('CREATE:', created);

  console.log('STATUS (initial):', await sdk.withdrawals.status(created));

  // Wait for L2 inclusion
  const l2Receipt = await sdk.withdrawals.wait(created, { for: 'l2' });
  console.log('L2 included:', l2Receipt?.hash);

  // Wait until ready to finalize
  await sdk.withdrawals.wait(created, { for: 'ready' });
  console.log('STATUS (ready):', await sdk.withdrawals.status(created));

  // Try to finalize (no-op if already finalized by someone else)
  const fin = await sdk.withdrawals.tryFinalize(created.l2TxHash);
  console.log('TRY FINALIZE:', fin);

  // Wait for finalization
  const l1Receipt = await sdk.withdrawals.wait(created.l2TxHash, { for: 'finalized' });
  console.log('Finalized. L1 receipt:', l1Receipt?.hash);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
