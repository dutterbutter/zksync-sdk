# Adapters: `viem` & `ethers`

The SDK is designed to work _with_ the tools you already know and love. It's not a standalone library, but rather an extension that plugs into your existing `viem` or `ethers.js` setup.

Think of it like a power adapter 🔌. You have your device (`viem` or `ethers` client), and this SDK adapts it to work seamlessly with zkSync's unique features. You bring your own client, and the SDK enhances it.

## Why an Adapter Model?

This approach offers several key advantages:

- ✅ **Bring Your Own Stack:** You don't have to replace your existing setup. The SDK integrates directly with the `viem` clients (`PublicClient`, `WalletClient`) or `ethers` providers and signers you're already using.
- 📚 **Familiar Developer Experience (DX):** You continue to handle connections, accounts, and signing just as you always have.
- 🧩 **Lightweight & Focused:** The SDK remains small and focused on one thing: providing a robust API for ZKsync-specific actions like deposits and withdrawals.

## Installation

First, install the core SDK, then add the adapter that matches your project's stack.

```bash
# For viem users
npm install @zksync-sdk/viem viem

# For ethers.js users
npm install @zksync-sdk/ethers ethers
```

---

## How to Use

The setup is minimal. You create your `viem` client or `ethers` provider/signer as usual and pass it to the SDK's `createZksyncClient` function.

#### **viem Example**

Notice how you configure a standard `viem` client first, then pass it to the SDK.

```ts
import { createPublicClient, http } from 'viem';
import { zkSync } from 'viem/chains';
import { createZksyncClient } from '@zksync-sdk/viem';

// 1. Create a standard viem client
const viemClient = createPublicClient({
  chain: zkSync,
  transport: http(),
});

// 2. Pass it to the SDK to create a zkSync client
const client = createZksyncClient({
  client: viemClient,
});

// 3. You can now access zkSync features
const quote = await client.deposits.quote({
  /* ... params ... */
});
console.log('Total fee:', quote.totalFee.toString());
```

#### **ethers.js Example**

The pattern is the same for `ethers`. Create your provider or signer, then give it to the SDK.

```ts
import { JsonRpcProvider, Wallet } from 'ethers';
import { createZksyncClient } from '@zksync-sdk/ethers';

// 1. Create a standard ethers provider or signer
const provider = new JsonRpcProvider('https://mainnet.era.zksync.io');
// const signer = new Wallet(PRIVATE_KEY, provider); // For write operations

// 2. Pass it to the SDK to create a zkSync client
const client = createZksyncClient({
  provider, // or signer
});

// 3. Your code for using the SDK is the same!
const quote = await client.deposits.quote({
  /* ... params ... */
});
console.log('Total fee:', quote.totalFee.toString());
```

---

## Key Principles

- **No Key Management:** The SDK never asks for or stores private keys. All signing operations are delegated to the `viem` `WalletClient` or `ethers` `Signer` you provide.
- **API Parity:** Both adapters expose the exact same API. The code you write to call `client.deposits.quote()` is identical whether you're using `viem` or `ethers`.
- **Easy Migration:** Because the API is the same, switching your project from `ethers` to `viem` (or vice versa) is incredibly simple. You only need to change the initialization code.
