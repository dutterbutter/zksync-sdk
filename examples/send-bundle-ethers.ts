import { Wallet, JsonRpcProvider } from 'ethers';
import { sendBundle }             from '@zksync-sdk/ethers/actions';
import { bundle, Chains }         from '@zksync-sdk/core';

const signer = new Wallet("0x", new JsonRpcProvider('https://mainnet.era.zksync.io'));

const DUTTER_BUTTER = "0x7182fA7dF76406ffFc0289f36239aC1bE134f305"
const DUT_TOKEN = "0x"

// TODO: update to addresses and token for runnable example.
await sendBundle(signer, {
  src : Chains.era,
  dest: Chains.abs,
  items: [
    bundle.native({ to: DUTTER_BUTTER, amount: 1_000_000_000_000_000n }),
    bundle.erc20 ({ token: DUT_TOKEN , to: DUTTER_BUTTER, amount: 50_000_000n }),
  ],
});
