// examples/deposit-eth.ts
import { JsonRpcProvider, Contract, Wallet, parseUnits, type Signer } from 'ethers';
import { createEthersClient } from '../src/adapters/ethers/client';
import { createEthersSdk } from '../src/adapters/ethers/kit';
import { Address } from '../src/types/primitives';

// const L1_RPC = "https://sepolia.infura.io/v3/07e4434e9ba24cd68305123037336417";                     // e.g. https://sepolia.infura.io/v3/XXX
// const L2_RPC = "https://zksync-os-stage-api.zksync-nodes.com";                     // your L2 RPC
// const PRIVATE_KEY = "0x3a86a76b2aee7d0742f2da930b3289cfcff31f57ffc923c672715ead32dc01a0";

const L1_RPC = 'http://localhost:8545'; // e.g. https://sepolia.infura.io/v3/XXX
const L2_RPC = 'http://localhost:3050'; // your L2 RPC
const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

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

  const TOKEN = '0x8464135c8F25Da09e49BC8782676a84730C318bC' as Address;

  // 3) Deposit params: send 10 units of ERC20 (respecting decimals) to my own L2 address
  const me = (await signer.getAddress()) as Address;
  const decimals = await erc20(l1, TOKEN).decimals();
  const amount = parseUnits('1000', decimals);
  console.log('calling mint');
  await mintErc20({ signer, token: TOKEN, to: me, amount });
  console.log('Minted:', amount.toString());

  const depositAmount = parseUnits('25', decimals);
  const quote = await sdk.deposits.quote({ token: TOKEN, to: me, amount: depositAmount });
  console.log('QUOTE:', quote);

  const handle = await sdk.deposits.create({ token: TOKEN, to: me, amount: depositAmount });
  console.log('L1 tx hash:', handle.l1TxHash);

  const receipt = await sdk.deposits.wait(handle, { for: 'l1' });
  console.log('Included at block:', receipt?.blockNumber, 'status:', receipt?.status);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
