# What this SDK Does

The `@zksync-sdk` is a lightweight, powerful extension for the popular `ethers.js` and `viem` libraries. Its purpose is to simplify the development of applications on ZKsync by providing straightforward access to ZKsync-specific features that are not natively available in the core Ethereum SDKs.

Think of it as a specialized toolkit that sits on top of the tools you already know and love, enabling you to seamlessly interact with both L1 and L2 functionalities of the Elastic Network.

## Audience

This SDK is designed for **Web3 developers, dApp builders, and infrastructure engineers** who are building applications on or interacting with the Elastic Network. If you're comfortable with `ethers.js` or `viem` and need to implement ZKsync-specific actions, this library is for you.

## Scope

The SDK currently supports ZKsync specific actions, primarily L1-L2, and L2-L1 transactions.

### Key Supported Features

- **Deposits (L1 → L2)** — ETH and ERC-20
  - **Initiate on L1:** build and send the deposit transaction from Ethereum.
  - **Track progress:** query intermediate states (queued, included, executed).
  - **Verify completion on L2:** confirm funds credited/available on ZKsync (L2).

- **Withdrawals (L2 → L1)** — ETH and ERC-20
  - **Initiate on L2:** create the withdrawal transaction on ZKsync (L2).
  - **Track progress:** monitor execution and finalization availability.
  - **Finalize on L1:** Finalize withdrawal to release funds (L1).

- **ZKsync RPC**
  - **`getBridgehubAddress`** (`zks_getBridgehubContract`)  
    Resolve the canonical Bridgehub contract address.
  - **`getL2ToL1LogProof`** (`zks_getL2ToL1LogProof`)  
    Retrieves the log proof for an L2 to L1 transaction.
  - **`getReceiptWithL2ToL1`** *(receipt extension)*  
    Returns an Ethereum `TransactionReceipt` **augmented** with `l2ToL1Logs`.

## Non-Goals

To maintain its focus and lightweight nature, this SDK explicitly avoids duplicating functionality that is already well-handled by `ethers.js`, `viem`, or other dedicated libraries.

The following are **out of scope**:

- **Wallet Management & Signing:** The SDK does not manage private keys, mnemonics, or other sensitive credentials. It expects a pre-configured Signer or Wallet Client from `ethers` or `viem`. Key storage and transaction signing are delegated to these underlying libraries.
- **Generic Ethereum Interactions:** Standard Ethereum transactions, contract calls, or RPC methods that are not specific to ZKsync should be handled directly by `ethers` or `viem`.

---

ℹ️ Runtime compatibility follows the adapter you choose (`viem` or `ethers`).  
See their docs for environment support.
