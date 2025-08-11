// examples/send-transfers.ts
import { Wallet, JsonRpcProvider, parseEther } from 'ethers';
import { sendNative, sendERC20 } from '@zksync-sdk/ethers/actions';
import { Chains } from '@zksync-sdk/core';

/* -------------------------------------------------------------------------- */
/*  Minimal demo set-up                                                        */
/* -------------------------------------------------------------------------- */
const signer = new Wallet(process.env.PRIVATE_KEY!, new JsonRpcProvider('http://localhost:3050'));

// Sample addresses – replace with real ones in your environment
const DUTTER_BUTTER = '0x';
const DUT_TOKEN = '0x';

/* -------------------------------------------------------------------------- */
/*  1. Native ETH transfer                                                    */
/* -------------------------------------------------------------------------- */
await sendNative(signer, {
  src: Chains.era,
  dest: Chains.abs,
  to: DUTTER_BUTTER,
  amount: parseEther('0.001'), // 0.001 ETH
});

/* -------------------------------------------------------------------------- */
/*  2. Direct ERC-20 transfer                                                 */
/*     – Tokens are delivered straight to the recipient on destination chain  */
/*     – SDK auto-approves if allowance < amount                              */
/* -------------------------------------------------------------------------- */
await sendERC20(signer, {
  src: Chains.era,
  dest: Chains.abs,
  token: DUT_TOKEN,
  to: DUTTER_BUTTER,
  amount: 50_000_000n,
  approveIfNeeded: true,
});

/* -------------------------------------------------------------------------- */
/*  3. Indirect ERC-20 transfer                                               */
/*     – Value first deposited via AssetRouter / NativeTokenVault             */
/*     – Requires a small msg.value that stays inside the bundle              */
/* -------------------------------------------------------------------------- */
await sendERC20(signer, {
  src: Chains.era,
  dest: Chains.abs,
  token: DUT_TOKEN,
  to: DUTTER_BUTTER,
  amount: 100_000_000n,
  indirect: true,
  bridgeMsgValue: 1n,
  approveIfNeeded: true,
});
