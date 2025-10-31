// examples/ethers/interop/send-native.ts
import { JsonRpcProvider, Wallet, parseEther } from 'ethers';
import {
  createEthersClient,
  createEthersSdk,
  createInteropResource,
} from '../../../src/adapters/ethers';
import { actions as interopActions, type Address, type InteropParams } from '../../../src/core';

const L1_RPC = process.env.L1_RPC ?? 'http://127.0.0.1:8545';
const SRC_L2_RPC = process.env.SRC_L2_RPC ?? 'http://127.0.0.1:3050';
const DST_L2_RPC = process.env.DST_L2_RPC ?? 'http://127.0.0.1:3250';
const GW_RPC = process.env.GW_RPC ?? 'http://127.0.0.1:3150';
const PRIVATE_KEY =
  process.env.PRIVATE_KEY ?? '0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110';

const SRC_CHAIN_ID = 271n;
const DST_CHAIN_ID = 260n;

async function main() {
  if (!PRIVATE_KEY) throw new Error('Set your PRIVATE_KEY in env');

  // Providers:
  // - l2: source chain where we initiate the interop send
  // - l1: still required by client for address discovery / proofs
  const l1 = new JsonRpcProvider(L1_RPC);
  const l2 = new JsonRpcProvider(SRC_L2_RPC);

  // Signer must be funded on source L2 (client.l2)
  const signer = new Wallet(PRIVATE_KEY, l2);

  // Build low-level client + high-level sdk
  const client = await createEthersClient({
    l1: new JsonRpcProvider(L1_RPC),
    l2: new JsonRpcProvider(SRC_L2_RPC),
    signer: new Wallet(PRIVATE_KEY),
    chains: {
      [SRC_CHAIN_ID.toString()]: new JsonRpcProvider(SRC_L2_RPC), // register source too
      [DST_CHAIN_ID.toString()]: new JsonRpcProvider(DST_L2_RPC), // and destination
    },
  });
  const sdk = createEthersSdk(client);

  // Sender (on source chain) and recipient (on destination chain).
  const me = (await signer.getAddress()) as Address;
  const recipientOnDst = me as Address; // send to self on destination for demo

  // Interop params: single native transfer
  //
  // This says:
  //  - "bridge/forward 0.01 ETH-equivalent from source to DST_CHAIN_ID"
  //  - "deliver it to recipientOnDst"
  //
  // Route selection ('direct' vs 'indirect') will be decided automatically
  // based on base token match & ERC20 usage.
  const params = {
    sender: me, // optional; will default to connected signer anyway
    dst: DST_CHAIN_ID, // destination EIP-155 chain ID
    actions: [
      {
        type: 'sendNative',
        to: recipientOnDst,
        amount: parseEther('0.01'),
      },
    ],
    // Optional bundle-level execution constraints:
    // execution: { only: someExecAddress },
    // unbundling: { by: someUnbundlerAddress },
  } as const;

  // --------
  // 1. QUOTE
  // --------
  const quote = await sdk.interop.quote(params);
  console.log('QUOTE:', quote);
  // {
  //   route: 'direct' | 'indirect',
  //   approvalsNeeded: [],
  //   totalActionValue: ...,
  //   bridgedTokenTotal: ...,
  //   l1Fee?: ...,
  //   l2Fee?: ...
  // }

  // ---------
  // 2. PREPARE
  // ---------
  const prepared = await sdk.interop.prepare(params);
  console.log('PREPARE:', prepared);
  // {
  //   route: 'direct' | 'indirect',
  //   summary: <InteropQuote>,
  //   steps: [
  //     {
  //       key: 'sendBundle',
  //       kind: 'interop.center',
  //       description: 'Send interop bundle (...)',
  //       tx: { to, data, value, gasLimit?, ... }
  //     }
  //   ]
  // }

  // --------------
  // 3. CREATE (src)
  // --------------
  const created = await sdk.interop.create(params);
  console.log('CREATE:', created);
  // {
  //   kind: 'interop',
  //   stepHashes: { sendBundle: '0xabc...' },
  //   plan: <the same plan we saw in prepare()>,
  //   l2SrcTxHash: '0xabc...',       // tx that emitted InteropBundleSent
  //   dstChainId: 260n,              // destination chain ID
  // }

  // --------------------------
  // 4. STATUS (initial, SENT)
  // --------------------------
  const st0 = await sdk.interop.status(created);
  console.log('STATUS after create:', st0);
  // {
  //   phase: 'SENT' | 'VERIFIED' | 'EXECUTED' | ...,
  //   l2SrcTxHash?: '0x...',
  //   bundleHash?:  '0x...',
  //   dstChainId?:  260n,
  //   dstExecTxHash?: '0x...'
  // }

  // -------------------------------------------------
  // 5. WAIT UNTIL VERIFIED ON DEST (PROVABLE / READY)
  // -------------------------------------------------
  // This polls until the destination chain marks the bundle as verified
  // (BundleVerified event / handler logic).
  await sdk.interop.wait(created, { for: 'verified', pollMs: 5_000 });
  console.log('Bundle is VERIFIED / ready to execute on destination.');

  // You can inspect updated status again here if you want:
  const st1 = await sdk.interop.status(created);
  console.log('STATUS after verified:', st1);
  // phase should now be 'VERIFIED'
  // st1.bundleHash should be known
  // st1.dstChainId should be known

  // -----------------------------------------------------
  // 6. FINALIZE (EXECUTE ON DESTINATION AND BLOCK UNTIL DONE)
  // -----------------------------------------------------
  // finalize() calls executeBundle(...) on the destination chain,
  // waits for the tx to mine, then returns { bundleHash, dstChainId, dstExecTxHash }.
  const fin = await sdk.interop.finalize(created);
  console.log('FINALIZE RESULT:', fin);
  // {
  //   bundleHash: '0x...',
  //   dstChainId: 260n,
  //   dstExecTxHash: '0x...'
  // }

  // After this point, the value should be delivered / available on dst.

  // --------------------------------
  // 7. STATUS (terminal: EXECUTED)
  // --------------------------------
  const st2 = await sdk.interop.status(created);
  console.log('STATUS after finalize:', st2);
  // phase should now be 'EXECUTED' (or 'UNBUNDLED' in partial-exec flows)
  // dstExecTxHash should match fin.dstExecTxHash
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
