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
import { createEthersSdk } from '../src/adapters/ethers/kit';
import type { Address } from '../src/core/types/primitives';

import { Contract } from 'ethers';
import {
  L2_NATIVE_TOKEN_VAULT_ADDR,
} from '../src/core/constants';

import { TransactionReceiptZKsyncOS } from '../src/adapters/ethers/resources/withdrawals/routes/types';

import IBridgehubABI from "../src/internal/abis/IBridgehub.json" assert { type: "json" };
import IL1AssetRouterABI from "../src/internal/abis/IL1AssetRouter.json" assert { type: "json" };
import IL1NativeTokenVaultABI from "../src/internal/abis/IL1NativeTokenVault.json" assert { type: "json" };
import IL2NativeTokenVaultABI from "../src/internal/abis/IL2NativeTokenVault.json" assert { type: "json" };
import IERC20ABI from '../src/internal/abis/IERC20.json' assert { type: 'json' };
import { sleep } from 'bun';

async function resolveL2TokenAddressViaAssetId(
  l1: JsonRpcProvider,
  l2: JsonRpcProvider,
  bridgehub: Address,
  l1Token: Address
): Promise<Address> {
  const bh = new Contract(bridgehub, IBridgehubABI, l1);
  const l1AssetRouter = (await bh.assetRouter()) as Address;

  const ar = new Contract(l1AssetRouter, IL1AssetRouterABI, l1);
  const l1NTV = (await ar.nativeTokenVault()) as Address;
  console.log('L1 NTV:', l1NTV);
  const ntvL1 = new Contract(l1NTV, IL1NativeTokenVaultABI, l1);
  const assetId = (await ntvL1.assetId(l1Token)) as `0x${string}`;
  if (!assetId || /^0x0+$/.test(assetId)) {
    throw new Error(`L1 NTV has no assetId for ${l1Token} (token not registered?)`);
  }

  const ntvL2 = new Contract(L2_NATIVE_TOKEN_VAULT_ADDR, IL2NativeTokenVaultABI, l2);
  const l2Token = (await ntvL2.tokenAddress(assetId)) as Address;

  if (!l2Token || /^0x0+$/.test(l2Token)) {
    // predictable address fallback
    const l1ChainId = await bh.L1_CHAIN_ID().catch(() => undefined);
    if (l1ChainId != null) {
      const expected = (await ntvL2.calculateCreate2TokenAddress(l1ChainId, l1Token)) as Address;
      if (expected && !/^0x0+$/.test(expected)) return expected;
    }
    throw new Error(`L2 NTV has no tokenAddress for assetId ${assetId} (not deployed/registered yet)`);
  }

  return l2Token;
}

// Replace with a real **L2 ERC-20 token address** you hold on L2
const L1_ERC20_TOKEN = '0x71C95911E9a5D330f4D621842EC243EE1343292e' as Address;

async function main() {
  // 1) Providers + signer (signer is on L1; SDK will connect it as needed)
  const l1 = new JsonRpcProvider(L1_RPC);
  const l2 = new JsonRpcProvider(L2_RPC);
  const signer = new Wallet(PRIVATE_KEY, l1);

  // 2) Client + SDK
  const client = createEthersClient({ l1, l2, signer });
  const sdk = createEthersSdk(client);

  const me = (await signer.getAddress()) as Address;

  // 3) Discover Bridgehub (no hardcoding) and resolve L2 token for our L1 token
  const { bridgehub } = await client.ensureAddresses();
  const l2Token = await resolveL2TokenAddressViaAssetId(l1, l2, bridgehub, L1_ERC20_TOKEN);

  // (Optional) Read symbols/decimals to make the logs nice
  const erc20L1 = new Contract(L1_ERC20_TOKEN, IERC20ABI, l1);
  const erc20L2 = new Contract(l2Token, IERC20ABI, l2);
  const [sym, dec] = await Promise.all([erc20L2.symbol(), erc20L2.decimals()]);

  // 4) Balances before
  const [balL1Before, balL2Before] = await Promise.all([
    erc20L1.balanceOf(me),
    erc20L2.balanceOf(me),
  ]);
  console.log(`[${sym}] balances before  L1=${balL1Before}  L2=${balL2Before}`);

  // // 5) Prepare withdraw params (ERC-20 route uses L2 token address)
  // const params = {
  //   token: l2Token,                  // L2 ERC-20
  //   amount: parseUnits('25', dec),   // withdraw 25 tokens
  //   to: me,                          // optional; defaults to sender if omitted
  //   // l2GasLimit: 300_000n,         // optional override
  // } as const;

  // // 6) Quote (dry-run)
  // const quote = await sdk.withdrawals.quote(params);
  // console.log('QUOTE:', quote);

  // // 7) Create → sends L2 approval(s) if needed, then withdraw call
  // const handle = await sdk.withdrawals.create(params);
  // console.log('Withdrawal handle:', handle);
  // console.log('L2 withdraw tx hash:', handle.l2TxHash);

  // // 8) Wait for L2 inclusion (only)
  // const l2Receipt: TransactionReceiptZKsyncOS | null = await sdk.withdrawals.wait(handle, { for: 'l2' });
  // console.log('L2 receipt hash:', l2Receipt?.hash);
  // console.log('L2 l2ToL1Logs (if any):', (l2Receipt as any)?.l2ToL1Logs ?? []);

  // console.log('Withdrawal initiated on L2. Finalization on L1 can take several hours.');

  // await sleep(100000);

  // 9) (Later) Check tri-state. We DO NOT poll tightly; we just check now.
  const state = await sdk.withdrawals.isFinalized("0x11d076da79a77792e1d6311aeb556b44abcbdb56dee461892c203ddc1d5f789d");
  console.log('Finalization state:', state); // 'unknown' | 'pending' | 'finalized'

   const res = await sdk.withdrawals.finalize("0x11d076da79a77792e1d6311aeb556b44abcbdb56dee461892c203ddc1d5f789d");
    console.log('Finalize result:', res.status, res.receipt?.hash ?? '(already finalized)');

  // if (state === 'finalized') {
  //   console.log('Already finalized on L1.');
  // } else if (state === 'pending') {
  //   // Proofs are ready and not yet finalized → finalize now
  //   const res = await sdk.withdrawals.finalize("0x11d076da79a77792e1d6311aeb556b44abcbdb56dee461892c203ddc1d5f789d");
  //   console.log('Finalize result:', res.status, res.receipt?.hash ?? '(already finalized)');
  // } else {
  //   // 'unknown' => proofs not ready yet
  //   console.log('Not ready to finalize yet. Try again later.');
  // }  

  // 10) Balances after (useful when finalize just happened)
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