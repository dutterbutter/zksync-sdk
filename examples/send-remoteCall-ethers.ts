import { Wallet, JsonRpcProvider, Interface } from 'ethers';
import { remoteCall } from '@zksync-sdk/ethers/actions';
import { Chains } from '@zksync-sdk/core';

async function main() {
  // ── signer ──────────────────────────────────────────────────────
  const signer = new Wallet('0x', new JsonRpcProvider('http://localhost:3050'));

  // target + calldata
  const TARGET = '0xe441CF0795aF14DdB9f7984Da85CD36DB1B8790d' as const;
  const ABI = ['function ping(uint256 n)'];

  const iface = new Interface(ABI);
  const calldata = iface.encodeFunctionData('ping', [42n]) as `0x${string}`;

  // ── single-call cross-chain message ───────────────────────────────────────────
  const receipt = await remoteCall(signer, {
    src: Chains.local_era,
    dest: Chains.local_gateway,
    to: TARGET,
    data: calldata,
    value: 0n,
  });

  console.log('sendId:', receipt.sendId);
  console.log('srcTx :', receipt.srcTxHash);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
