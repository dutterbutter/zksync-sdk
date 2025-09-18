# Choosing Your Adapter: `viem` vs. `ethers`

The SDK is designed to work with both `viem` and `ethers.js`, the two most popular Ethereum libraries. Since the SDK offers **identical functionality** for both, the choice comes down to your project's needs and your personal preference.

## The Short Answer (TL;DR)

- **If you're adding the SDK to an existing project:** Use the adapter for the library you're **already using**.
- **If you're starting a new project:** The choice is yours. **`viem` is generally recommended for new projects** due to its modern design, smaller bundle size, and excellent TypeScript support.

You can't make a wrong choice. Both adapters are fully supported and provide the same features.

## Code Comparison

The only difference in your code will be the initial setup. **All subsequent SDK calls are identical.**

Notice how you pass a `client` object for `viem` and a `provider`/`signer` for `ethers`. After that, the API is the same.

#### **viem**

```ts
import { createPublicClient, http } from 'viem';
import { zkSync } from 'viem/chains';
import { createZksyncClient } from '@zksync-sdk/viem';

// 1. Create a viem client
const viemClient = createPublicClient({
  chain: zkSync,
  transport: http(),
});

// 2. Pass it to the SDK
const client = createZksyncClient({
  client: viemClient,
});
```

#### **ethers.js**

```ts
import { JsonRpcProvider } from 'ethers';
import { createZksyncClient } from '@zksync-sdk/ethers';

// 1. Create an ethers provider
const provider = new JsonRpcProvider('https://mainnet.era.zksync.io');

// 2. Pass it to the SDK
const client = createZksyncClient({
  provider,
});
```

### Identical SDK Usage

Regardless of the adapter you choose, your application logic for interacting with zkSync will look exactly the same.

```ts
// This code works for both viem and ethers adapters!
const quote = await client.deposits.quote({
  token: ETH_ADDRESS_IN_CONTRACTS,
  amount: parseEther('0.1'),
  to: '0x...',
});

console.log('Total fee:', quote.totalFee.toString());
```

## Conclusion

The adapter model is designed to give you flexibility without adding complexity. Your choice of adapter is a low-stakes decision that's easy to change later.

**Ready to start building?** 🚀

- [**Go to Quickstart (viem)**]()
- [**Go to Quickstart (ethers)**]()
