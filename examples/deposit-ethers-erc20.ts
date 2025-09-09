// examples/deposit-eth.ts
import { JsonRpcProvider, Contract, Wallet, parseUnits, type Signer } from 'ethers';
import { createEthersClient } from '../src/adapters/ethers/client';
import { createEthersSdk } from '../src/adapters/ethers/sdk';
import { Address } from '../src/core/types/primitives';
import MintableERC20ABI from '../src/internal/abis/IERC20.json' assert { type: 'json' };

// const L1_RPC = "https://sepolia.infura.io/v3/07e4434e9ba24cd68305123037336417";                     // e.g. https://sepolia.infura.io/v3/XXX
// const L1_RPC = "https://rpc.ankr.com/eth_sepolia/070715f5f3878124fc8e3b05fa7e5f8ec165ffc887f2ffd3a51c9e906681492c"
// const L2_RPC = "https://zksync-os-stage-api.zksync-nodes.com";                     // your L2 RPC
// const PRIVATE_KEY = "0x3a86a76b2aee7d0742f2da930b3289cfcff31f57ffc923c672715ead32dc01a0";

const L1_RPC = 'http://localhost:8545';
const L2_RPC = 'http://localhost:3050';
const PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

export function erc20(signerOrProvider: Signer | JsonRpcProvider, token: Address) {
  return new Contract(token, MintableERC20ABI, signerOrProvider);
}

/** Mint tokens */
export async function mintErc20(args: {
  signer: Signer;
  token: Address;
  to: Address;
  amount: bigint;
}) {
  const c = erc20(args.signer, args.token);
  const tx = await c.mint(args.to, args.amount);
  return await tx.wait();
}

async function main() {
  const l1 = new JsonRpcProvider(L1_RPC);
  const l2 = new JsonRpcProvider(L2_RPC);
  const signer = new Wallet(PRIVATE_KEY, l1);

  const client = await createEthersClient({ l1, l2, signer });
  const sdk = createEthersSdk(client);
  // // sepolia
  //const TOKEN = '0x8464135c8F25Da09e49BC8782676a84730C318bC' as Address;
  // local
  const TOKEN = '0x71C95911E9a5D330f4D621842EC243EE1343292e' as Address;

  const me = (await signer.getAddress()) as Address;
  const decimals = await erc20(l1, TOKEN).decimals();
  const amount = parseUnits('100000', decimals);
  await mintErc20({ signer, token: TOKEN, to: me, amount });

  const depositAmount = parseUnits('250', decimals);

  // quote
  const tryQuote = await sdk.deposits.tryQuote({ token: TOKEN, to: me, amount: depositAmount });
  console.log('TRY QUOTE response: ', tryQuote);
  const quote = await sdk.deposits.quote({ token: TOKEN, to: me, amount: depositAmount });
  console.log('QUOTE:', quote);

  const tryPrepare = await sdk.deposits.tryPrepare({ token: TOKEN, to: me, amount: depositAmount });
  console.log('TRY PREPARE:', tryPrepare);
  const prepare = await sdk.deposits.prepare({ token: TOKEN, to: me, amount: depositAmount });
  console.log('PREPARE:', prepare);

  const create = await sdk.deposits.create({ token: TOKEN, to: me, amount: depositAmount });
  console.log('CREATE:', create);

  // Wait until the L1 tx is included
  const receipt = await sdk.deposits.wait(create, { for: 'l1' });
  console.log(
    'Included at block:',
    receipt?.blockNumber,
    'status:',
    receipt?.status,
    'hash:',
    receipt?.hash,
  );

  // Wait until the L2 tx is included
  const l2Receipt = await sdk.deposits.wait(create, { for: 'l2' });
  console.log(
    'Included at block:',
    l2Receipt?.blockNumber,
    'status:',
    l2Receipt?.status,
    'hash:',
    l2Receipt?.hash,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
