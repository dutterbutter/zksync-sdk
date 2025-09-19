<div align="center">

# ⚡️ zksync-sdk ⚡️

_TypeScript SDK for deposits, withdrawals, and RPC access across the Elastic Network_

[![CI Status](https://github.com/dutterbutter/zksync-sdk/actions/workflows/checks.yaml/badge.svg)](https://github.com/dutterbutter/zksync-sdk/actions/workflows/checks.yaml)
[![Release](https://img.shields.io/github/v/release/dutterbutter/zksync-sdk?label=version)](https://github.com/dutterbutter/zksync-sdk/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![X: @zksync](https://img.shields.io/badge/follow-@zksync-1DA1F2?logo=x)](https://x.com/zksync)
[![User Book](https://img.shields.io/badge/docs-user%20book-brightgreen)](https://dutterbutter.github.io/zksync-sdk/)

</div>

<p align="center">
  <b>
    <a href="https://dutterbutter.github.io/zksync-sdk/latest/quickstart/">Quickstart</a> ·
    <a href="https://dutterbutter.github.io/zksync-sdk/">User Book</a> ·
    <a href="./.github/CONTRIBUTING.md">Contributing</a>
  </b>
</p>

## ✨ Features

- **Adapters for both worlds** – choose [`viem`](https://viem.sh) or [`ethers`](https://docs.ethers.io)
- **Deposits (L1 → L2)** – seamless ETH and ERC-20 transfers into zkSync
- **Withdrawals (L2 → L1)** – full two-step flows with status tracking + finalization
- **ZKsync RPC methods** – typed helpers for proofs, receipts, and bridgehub access
- **Helper methods** – helpers for l1-l2 token address mapping, contract address fetching
- **Try-methods** – no-throw style (`tryCreate`, `tryWait`) for UI / services

## 📦 Installation

Install the adapter you need:

<details>
<summary><strong>viem adapter</strong></summary>

```bash
npm install @zksync-sdk viem
```

</details>

<details>
<summary><strong>ethers adapter</strong></summary>

```bash
npm install @zksync-sdk ethers
```

</details>

## ⚡️ Quick-start

**ETH deposit (ethers)**

```ts
import { JsonRpcProvider, Wallet, parseEther } from 'ethers';
import { createEthersClient } from '@zksync-sdk/ethers';
import { ETH_ADDRESS } from '@zksync-sdk/core';

const l1Provider = new JsonRpcProvider('https://sepolia.infura.io/v3/...');
const l2Provider = new JsonRpcProvider('https://zksync-testnet.rpc');
const signer = new Wallet(process.env.PRIVATE_KEY!, l1Provider);

const client = await createEthersClient({ l1Provider, l2Provider, signer });

const deposit = await client.deposits.create({
  token: ETH_ADDRESS,
  amount: parseEther('0.01'),
  to: signer.address,
});

await sdk.deposits.wait(handle, { for: 'l2' });
console.log('Deposit complete ✅');
```

**ETH deposit (viem)**

```ts
import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { createViemSdk } from '@zksync-sdk/viem';
import { ETH_ADDRESS } from '@zksync-sdk/core';

const l1 = createPublicClient({ transport: http('https://sepolia.infura.io/v3/...') });
const l2 = createPublicClient({ transport: http('https://zksync-testnet.rpc') });
const l1Wallet = createWalletClient({
  account,
  transport: http('https://sepolia.infura.io/v3/...'),
});

const sdk = createViemSdk({ l1, l2, l1Wallet });

const handle = await sdk.deposits.create({
  token: ETH_ADDRESS,
  amount: parseEther('0.01'),
  to: account.address,
});

await sdk.deposits.wait(handle, { for: 'l2' });
console.log('Deposit complete ✅');
```

> See [Quickstart docs](https://dutterbutter.github.io/zksync-sdk/quickstart/) for full examples.

## 📚 Documentation

- [User Book](https://dutterbutter.github.io/zksync-sdk/) – guides, concepts, API docs
- [How-to Guides](https://dutterbutter.github.io/zksync-sdk/guides/) – deposits, withdrawals, RPC helpers
- [Concepts](https://dutterbutter.github.io/zksync-sdk/concepts/) – mental model, status vs wait, finalization

## 🤝 Contributing

Bug reports, fixes, and new features are welcome! Please read the [contributing guide](.github/CONTRIBUTING.md) to get started.

## 📜 License

This project is licensed under the terms of the **MIT License** – see the [LICENSE](LICENSE) file for details.
