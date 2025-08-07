// examples/send-transfers.ts
import { Wallet, JsonRpcProvider }   from 'ethers';
import { sendNative, sendERC20 }     from '@zksync-sdk/ethers/actions';
import { Chains }                    from '@zksync-sdk/core';

const signer  = new Wallet("PRIV_KEY", new JsonRpcProvider('https://mainnet.era.zksync.io'));
const DUTTER_BUTTER = "0x7182fA7dF76406ffFc0289f36239aC1bE134f305"
const DUT_TOKEN = "0x"

// ── Native ETH transfer ────────────────────────────────────────────────────────
await sendNative(signer, {
  src   : Chains.era,
  dest  : Chains.abs,
  to    : DUTTER_BUTTER,
  amount: 1_000_000_000_000_000n,
});

// ── ERC-20 transfer (auto-approve if allowance too low) ───────────────────────
await sendERC20(signer, {
  src   : Chains.era,
  dest  : Chains.abs,
  token : DUT_TOKEN,
  to    : DUTTER_BUTTER,
  amount: 50_000_000n,
  approveIfNeeded: true,
});
