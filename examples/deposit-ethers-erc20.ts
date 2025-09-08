// examples/deposit-eth.ts
import { JsonRpcProvider, Contract, Wallet, parseUnits, type Signer } from 'ethers';
import { createEthersClient } from '../src/adapters/ethers/client';
import { createEthersSdk } from '../src/adapters/ethers/kit';
import { Address } from '../src/core/types/primitives';
import { sleep } from 'bun';

// const L1_RPC = "https://sepolia.infura.io/v3/07e4434e9ba24cd68305123037336417";                     // e.g. https://sepolia.infura.io/v3/XXX
// const L1_RPC = "https://rpc.ankr.com/eth_sepolia/070715f5f3878124fc8e3b05fa7e5f8ec165ffc887f2ffd3a51c9e906681492c"
// const L2_RPC = "https://zksync-os-stage-api.zksync-nodes.com";                     // your L2 RPC
// const PRIVATE_KEY = "0x3a86a76b2aee7d0742f2da930b3289cfcff31f57ffc923c672715ead32dc01a0";

const L1_RPC = 'http://localhost:8545'; // e.g. https://sepolia.infura.io/v3/XXX
const L2_RPC = 'http://localhost:3050'; // your L2 RPC
const PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

const MINTABLE_ERC20_ABI = [
  'function decimals() view returns (uint8)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function mint(address to, uint256 amount) external',
  'function balanceOf(address a) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
] as const;

export function erc20(signerOrProvider: Signer | JsonRpcProvider, token: Address) {
  return new Contract(token, MINTABLE_ERC20_ABI, signerOrProvider);
}

/** Mint tokens on a MintableERC20 you deployed (owner-only). */
export async function mintErc20(args: {
  signer: Signer; // must be the owner that deployed the token
  token: Address; // deployed MintableERC20
  to: Address;
  amount: bigint; // base units
}) {
  const c = erc20(args.signer, args.token);

  const tx = await c.mint(args.to, args.amount);

  return await tx.wait();
}

async function main() {
  console.log('running');
  // 1) Providers + signer (signer must be funded on L1)
  const l1 = new JsonRpcProvider(L1_RPC);
  const l2 = new JsonRpcProvider(L2_RPC);
  const signer = new Wallet(PRIVATE_KEY, l1);

  // 2) Create client + bounded SDK
  const client = await createEthersClient({ l1, l2, signer });
  const sdk = createEthersSdk(client);
  // // sepolia
  //const TOKEN = '0x8464135c8F25Da09e49BC8782676a84730C318bC' as Address;
  //local
  const TOKEN = '0x71C95911E9a5D330f4D621842EC243EE1343292e' as Address;

  // 3) Deposit params: send 10 units of ERC20 (respecting decimals) to my own L2 address
  const me = (await signer.getAddress()) as Address;
  const decimals = await erc20(l1, TOKEN).decimals();
  const amount = parseUnits('100000', decimals);
  console.log('calling mint');
  await mintErc20({ signer, token: TOKEN, to: me, amount });
  // console.log('Minted:', amount.toString());
  console.log('balance of erc20 token: ');

  const depositAmount = parseUnits('250', decimals);
  const quote = await sdk.deposits.quote({ token: TOKEN, to: me, amount: depositAmount });
  console.log('QUOTE:', quote);

  const handle = await sdk.deposits.create({ token: TOKEN, to: me, amount: depositAmount });
  console.log('L1 tx hash:', handle.l1TxHash);

  const receipt = await sdk.deposits.wait(handle, { for: 'l1' });
  console.log('Included at block:', receipt?.blockNumber, 'status:', receipt?.status);

  // // Wait until the corresponding L2 tx exists and is marked successful
  const l2Receipt = await sdk.deposits.wait(handle, { for: 'l2' });
  console.log('L2 RECEIPT', l2Receipt);
    console.log("Deposit executed on L2:", (l2Receipt as any)?.hash);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
