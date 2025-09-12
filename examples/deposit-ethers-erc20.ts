// examples/deposit-eth.ts
import { JsonRpcProvider, Contract, Wallet, parseUnits, type Signer } from 'ethers';
import { createEthersClient } from '../src/adapters/ethers/client';
import { createEthersSdk } from '../src/adapters/ethers/sdk';
import { Address } from '../src/core/types/primitives';
import MintableERC20ABI from '../src/internal/abis/IERC20.json' assert { type: 'json' };

// const L1_RPC = 'http://localhost:8545';
// const L2_RPC = 'http://localhost:3050';
// const PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

const L1_RPC = 'https://sepolia.infura.io/v3/07e4434e9ba24cd68305123037336417';
const L2_RPC = 'https://zksync-os-stage-api-b.zksync-nodes.com/';
const PRIVATE_KEY = '0x77b0287249f5c92f66814e9cf6f88fe6d6df6d9a878f5bba78a5074883fb4373';

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
  const TOKEN = '0x42E331a2613Fd3a5bc18b47AE3F01e1537fD8873' as Address;
  // local
  //const TOKEN = '0xbCF26943C0197d2eE0E5D05c716Be60cc2761508' as Address;

  const me = (await signer.getAddress()) as Address;
  const decimals = await erc20(l1, TOKEN).decimals();
  const amount = parseUnits('100000', decimals);
  await mintErc20({ signer, token: TOKEN, to: me, amount });

  const depositAmount = parseUnits('250', decimals);

  // quote
  const quote = await sdk.deposits.quote({ token: TOKEN, to: me, amount: depositAmount });
  console.log('QUOTE:', quote);

  const prepare = await sdk.deposits.prepare({ token: TOKEN, to: me, amount: depositAmount });
  console.log('PREPARE:', prepare);

  const create = await sdk.deposits.create({ token: TOKEN, to: me, amount: depositAmount });
  console.log('CREATE:', create);

  const status = await sdk.deposits.status(create);
  console.log('STATUS (immediate):', status);

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
