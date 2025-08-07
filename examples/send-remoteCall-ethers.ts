import { Wallet, JsonRpcProvider, Interface } from 'ethers';
import { remoteCall } from '@zksync-sdk/ethers/actions';
import { Chains }     from '@zksync-sdk/core';

// ── signer ──────────────────────────────────────────────────────
const signer = new Wallet("Ox", new JsonRpcProvider('https://mainnet.era.zksync.io'));

// target + calldata
const TARGET   = '0x1111111111111111111111111111111111111111' as const;
const ABI      = ['function ping(uint256 n)'];
const calldata = new Interface(ABI).encodeFunctionData('ping', [42n]) as `0x${string}`;

// ── single-call cross-chain message ───────────────────────────────────────────
const receipt = await remoteCall(signer, {
  src : Chains.era,
  dest: Chains.abs,
  to  : TARGET,
  data: calldata,
  value: 0n,
});

console.log('sendId:', receipt.sendId);
console.log('srcTx :', receipt.srcTxHash);
