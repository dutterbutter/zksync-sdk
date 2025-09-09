// examples/deposit-eth.ts
import { JsonRpcProvider, Wallet, parseEther } from 'ethers';
import { createEthersClient } from '../src/adapters/ethers/client';
import { createEthersSdk } from '../src/adapters/ethers/sdk';
import { Address } from '../src/core/types/primitives';
import { sleep } from 'bun';

// const L1_RPC = "https://sepolia.infura.io/v3/07e4434e9ba24cd68305123037336417";                     // e.g. https://sepolia.infura.io/v3/XXX
// const L2_RPC = "https://zksync-os-stage-api.zksync-nodes.com";                     // your L2 RPC
// const PRIVATE_KEY = "0x3a86a76b2aee7d0742f2da930b3289cfcff31f57ffc923c672715ead32dc01a0";

const L1_RPC = 'http://localhost:8545'; // e.g. https://sepolia.infura.io/v3/XXX
const L2_RPC = 'http://localhost:3050'; // your L2 RPC
const PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

async function main() {
  const l1 = new JsonRpcProvider(L1_RPC);
  const l2 = new JsonRpcProvider(L2_RPC);
  const signer = new Wallet(PRIVATE_KEY, l1);

  const balance = await l1.getBalance(signer.address);
  console.log('L1 balance:', balance.toString());

  const balanceL2 = await l2.getBalance(signer.address);
  console.log('L2 balance:', balanceL2.toString());

  const client = await createEthersClient({ l1, l2, signer });
  const sdk = createEthersSdk(client);

  const me = (await signer.getAddress()) as Address;
  const params = {
    amount: parseEther('.1'), // 0.1 ETH
    to: me,
    token: '0x0000000000000000000000000000000000000001' as Address,
    // optional:
    // l2GasLimit: 300_000n,
    // gasPerPubdata: 800n,
    // operatorTip: 0n,
    // refundRecipient: me,
  } as const;

  // Quote

  const tryQuote = await sdk.deposits.tryQuote(params);
  console.log('TRY QUOTE response: ', tryQuote);

  const quote = await sdk.deposits.quote(params);
  console.log('QUOTE response: ', quote);

  const tryPrepare = await sdk.deposits.tryPrepare(params);
  console.log('TRY PREPARE response: ', tryPrepare);

  const prepare = await sdk.deposits.prepare(params);
  console.log('PREPARE response: ', prepare);

  // Create (prepare + send)
  const create = await sdk.deposits.create(params);
  console.log('CREATE response: ', create);

  // Wait (for now, L1 inclusion)
  const receipt = await sdk.deposits.wait(create, { for: 'l1' });
  console.log(
    'Included at block:',
    receipt?.blockNumber,
    'status:',
    receipt?.status,
    'hash:',
    receipt?.hash,
  );

  // Wait (for now, L2 inclusion)
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
