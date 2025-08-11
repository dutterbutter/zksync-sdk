// examples/send-transfers.ts
import { Wallet, JsonRpcProvider, parseEther, parseUnits } from 'ethers';
import { sendNative, sendERC20 } from '@zksync-sdk/ethers/actions';
import { Chains } from '@zksync-sdk/core';

async function main() {
  console.log('Running transfer example');
  /* ---------- signer on SOURCE chain (271 / 3050) ---------- */
  const signer = new Wallet(
    '0x',
    new JsonRpcProvider('http://localhost:3050'), // local_era (271)
  );

  const RECIPIENT = '0x';
  const DUT_TOKEN = '0x111C3E89Ce80e62EE88318C2804920D4c96f92bb';

  /* ---------- 1) Native transfer ---------- */
  {
    const rc = await sendNative(signer, {
      src: Chains.local_era, // 271 (http://localhost:3050)
      dest: Chains.local_gateway, // 260 (http://localhost:3250)
      to: RECIPIENT,
      amount: parseEther('0.001'), // 0.001 ETH
    });
    console.log('[native] sendId:', rc.sendId, 'srcTx:', rc.srcTxHash);
  }

  /* ---------- 2) Direct ERC-20 transfer ---------- */
  {
    const rc = await sendERC20(signer, {
      src: Chains.local_era,
      dest: Chains.local_gateway,
      token: DUT_TOKEN,
      to: RECIPIENT,
      amount: parseUnits('50', 18),
      approveIfNeeded: true,
    });
    console.log('[erc20 direct] sendId:', rc.sendId, 'srcTx:', rc.srcTxHash);
  }

  // TODO: does not work due to version and some routing issue
  //   /* ---------- 3) Indirect ERC-20 transfer ---------- */
  //   {
  //     const rc = await sendERC20(signer, {
  //       src: Chains.local_era,
  //       dest: Chains.local_val,
  //       token: DUT_TOKEN,
  //       to: RECIPIENT,
  //       amount: parseUnits('100', 18),
  //       indirect: true,
  //       bridgeMsgValue: 0n,
  //       approveIfNeeded: true,
  //     });
  //     console.log('[erc20 indirect] sendId:', rc.sendId, 'srcTx:', rc.srcTxHash);
  //   }
}

main().catch((e) => (console.error(e), process.exit(1)));
