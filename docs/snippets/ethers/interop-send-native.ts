// examples/ethers/interop/send-native.ts
import { JsonRpcProvider, Wallet, parseEther } from 'ethers';
import {
  createEthersClient,
  createInteropResource,
} from '@dutterbutter/zksync-sdk/ethers';
import {
  actions as interopActions,
  type Address,
  type InteropParams,
} from '@dutterbutter/zksync-sdk/core';

const L1_RPC = process.env.L1_RPC ?? 'http://127.0.0.1:8545';
const SRC_L2_RPC = process.env.SRC_L2_RPC ?? 'http://127.0.0.1:3150';
const DST_L2_RPC = process.env.DST_L2_RPC ?? 'http://127.0.0.1:3250';
const PRIVATE_KEY = process.env.PRIVATE_KEY ?? '';

async function main() {
  if (!PRIVATE_KEY) {
    throw new Error('Set PRIVATE_KEY (hex string) in your environment before running.');
  }

  const l1 = new JsonRpcProvider(L1_RPC);
  const srcL2 = new JsonRpcProvider(SRC_L2_RPC);
  const dstL2 = new JsonRpcProvider(DST_L2_RPC);

  const signer = new Wallet(PRIVATE_KEY, l1);
  const client = createEthersClient({ l1, l2: srcL2, signer });

  const dstNet = await dstL2.getNetwork();
  const dstChainId = BigInt(dstNet.chainId);
  client.registerChain(dstChainId, dstL2);

  const interop = createInteropResource(client);
  const sender = (await signer.getAddress()) as Address;
  const amount = parseEther('0.01');

  const params: InteropParams = {
    sender,
    dst: dstChainId,
    actions: [interopActions.sendNative(sender, amount)],
  };

  console.log('Preparing interop quote...');
  const quote = await interop.quote(params);
  console.log('Quote:', quote);

  console.log('Sending bundle from source L2...');
  const handle = await interop.create(params);
  console.log('Bundle sent. Source tx hash:', handle.l2SrcTxHash);

  console.log('Waiting for verification on destination L2...');
  await interop.wait(handle, { for: 'verified', pollMs: 5_000, timeoutMs: 300_000 });
  console.log('Bundle verified.');

  console.log('Waiting for execution on destination L2...');
  await interop.wait(handle, { for: 'executed', pollMs: 5_000, timeoutMs: 300_000 });

  const status = await interop.status(handle);
  console.log('Final status:', status);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
