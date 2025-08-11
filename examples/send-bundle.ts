// examples/send-bundle.ts
import { Wallet, JsonRpcProvider, parseEther, parseUnits } from 'ethers';
import { sendBundle } from '@zksync-sdk/ethers/actions';
import { Chains, bundle } from '@zksync-sdk/core';

async function main() {
  console.log('Running bundle example');
  /* ---------- signer on SOURCE chain (271 / 3050) ---------- */
  const signer = new Wallet(
    '0x',
    new JsonRpcProvider('http://localhost:3050'), // local_era (271)
  );

  const RECIPIENT = '0x7182fA7dF76406ffFc0289f36239aC1bE134f305';
  const DUT_TOKEN = '0x111C3E89Ce80e62EE88318C2804920D4c96f92bb';

  /* ---------- 1) Bundle calls ---------- */
  const receipt = await sendBundle(signer, {
    src: Chains.local_era,
    dest: Chains.local_val,
    items: [
      bundle.native({ to: RECIPIENT, amount: parseEther('1') }),
      bundle.erc20({ token: DUT_TOKEN, to: RECIPIENT, amount: parseUnits('50', 18) }),
    ],
  });
  // TODO: fix this only the first calls sendID and txHash
  console.log('[bundlecalls] sendId:', receipt.sendId, 'srcTx:', receipt.srcTxHash);
}

main().catch((e) => (console.error(e), process.exit(1)));
