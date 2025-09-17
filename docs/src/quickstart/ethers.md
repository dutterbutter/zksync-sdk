# Quickstart (ethers): ETH Deposit (L1 → L2)

This guide will get you from zero to a working **ETH deposit from Ethereum to ZKsync (L2)** in minutes using the **ethers** adapter. 🚀

You'll set up your environment, write a short script to make a deposit, and run it.

## 1. Prerequisites

  * You have [Bun](https://bun.sh/) installed.
  * You have an L1 wallet (e.g., Sepolia testnet) funded with some ETH to pay for gas and the deposit.

## 2. Installation & Setup

First, install the necessary packages.

```bash
bun install @zksync-sdk/ethers ethers dotenv
```

Next, create a `.env` file in your project's root directory to store your private key and RPC endpoints. **Never commit this file to Git.**

**`.env` file:**

```env
# Your funded L1 wallet private key (e.g., from MetaMask)
PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE

# RPC endpoints
L1_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_ID
L2_RPC_URL="ZKSYNC-OS-TESTNET-RPC"
```

## 3. The Deposit Script

The following script will connect to the networks, create a deposit transaction, send it, and wait for it to be confirmed on both L1 and L2.

Save this code as `deposit.ts`:

```ts
import 'dotenv/config'; // Load environment variables from .env
import { JsonRpcProvider, Wallet, parseEther } from 'ethers';
import { createEthersClient } from '@zksync-sdk/ethers';
import { ETH_ADDRESS_IN_CONTRACTS } from '@zksync-sdk/core';

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const L1_RPC_URL = process.env.L1_RPC_URL;
const L2_RPC_URL = process.env.L2_RPC_URL;

async function main() {
  if (!PRIVATE_KEY || !L1_RPC_URL || !L2_RPC_URL) {
    throw new Error('Please set your PRIVATE_KEY, L1_RPC_URL, and L2_RPC_URL in a .env file');
  }

  // 1. SET UP PROVIDERS AND SIGNER
  // The SDK needs connections to both L1 and L2 to function.
  const l1Provider = new JsonRpcProvider(L1_RPC_URL);
  const l2Provider = new JsonRpcProvider(L2_RPC_URL);
  const signer = new Wallet(PRIVATE_KEY, l1Provider);

  // 2. INITIALIZE THE SDK CLIENT
  // The client is the low-level interface for interacting with the API.
  const client = await createEthersClient({
    l1Provider,
    l2Provider,
    signer,
  });

  console.log(`Wallet balance on L1: ${await client.l1.getBalance(signer.address)}`);
  console.log(`Wallet balance on L2: ${await client.l2.getBalance(signer.address)}`);
  
  // 3. PERFORM THE DEPOSIT
  // The create() method prepares and sends the transaction.
  // The wait() method polls until the transaction is complete.
  console.log('Sending deposit transaction...');
  const depositHandle = await client.deposits.create({
    token: ETH_ADDRESS_IN_CONTRACTS,
    amount: parseEther('0.001'), // 0.001 ETH
    to: signer.address,
  });

  console.log(`L1 transaction hash: ${depositHandle.l1TxHash}`);
  console.log('Waiting for the deposit to be confirmed on L1...');

  const l1Receipt = await depositHandle.waitL1();
  console.log(`Deposit confirmed on L1 in block ${l1Receipt.blockNumber}`);
  console.log('Waiting for the deposit to be finalized on L2...');

  const l2Receipt = await depositHandle.waitL2();
  console.log(`Deposit finalized on L2 in block ${l2Receipt.blockNumber}`);
  console.log('Deposit complete! ✅');

  console.log(`New wallet balance on L2: ${await client.l2.getBalance(signer.address)}`);

  /*
    // OPTIONAL: ADVANCED CONTROL
    // The SDK also lets you inspect a transaction before sending it.
    // This follows the Mental Model: quote -> prepare -> create.
    // Uncomment the code below to see it in action.

    const params = {
      token: ETH_ADDRESS_IN_CONTRACTS,
      amount: parseEther('0.001'),
      to: signer.address,
    };
    
    // Get a quote for the fees
    const quote = await client.deposits.quote(params);
    console.log('Fee quote:', quote);

    // Prepare the transaction without sending
    const plan = await client.deposits.prepare(params);
    console.log('Transaction plan:', plan);
  */
}

main().catch((error) => {
  console.error('An error occurred:', error);
  process.exit(1);
});
```

## 4. Run the Script

Execute the script using `bun`.

```bash
bun run deposit.ts
```

You should see output confirming the L1 transaction, the wait periods, and finally the successful L2 verification.

## 5. Troubleshooting

  * **Insufficient funds on L1:** Make sure your wallet has enough ETH on L1 to cover both the deposit amount (`0.001` ETH) and the L1 gas fees.
  * **Invalid `PRIVATE_KEY`:** Ensure it’s a 64-character hex string, prefixed with `0x`.
  * **Stuck waiting for L2:** This can take a few minutes. If it takes too long, check that your `L2_RPC_URL` is correct and the network is operational.

-----

## Next Steps

Now that you've completed a deposit, you can:

  * **Try an ERC20 Deposit:** This involves an additional `approve` step. The `quote()` method will tell you if an approval is needed.
  * **Explore Withdrawals:** Check out the guides for withdrawing funds from L2 back to L1.
  * **See the API Reference:** Dive deeper into the full capabilities of the SDK.
