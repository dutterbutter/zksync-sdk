// examples/deposit-erc20.ts
import { JsonRpcProvider, Contract, Wallet, parseUnits, type Signer } from 'ethers';
import { createEthersClient } from '../../src/adapters/ethers/client';
import { createEthersSdk } from '../../src/adapters/ethers/sdk';
import { Address } from '../../src/core/types/primitives';

const L1_RPC = 'http://localhost:8545'; // e.g. https://sepolia.infura.io/v3/XXX
const L2_RPC = 'http://localhost:3050'; // your L2 RPC
const PRIVATE_KEY =
  process.env.PRIVATE_KEY || '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

async function main() {
  const l1 = new JsonRpcProvider(L1_RPC);
  const l2 = new JsonRpcProvider(L2_RPC);
  const signer = new Wallet(PRIVATE_KEY, l1);

  const client = await createEthersClient({ l1, l2, signer });
  const sdk = createEthersSdk(client);
  // // sepolia
  const TOKEN = '0x8464135c8F25Da09e49BC8782676a84730C318bC' as Address;

  const me = (await signer.getAddress()) as Address;
  const depositAmount = parseUnits('250', 18);

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
