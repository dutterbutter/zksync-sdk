# Finalization (Withdrawals)

When withdrawing from ZKsync (L2) back to Ethereum (L1), **your funds are not automatically released on L1** once the L2 transaction is included.

Withdrawals are always a **two-step process**:

1. **Initiate on L2** — you call `withdraw()` (via the SDK’s `create`) to start the withdrawal.
   - This burns/locks the funds on L2.
   - At this point, your withdrawal is visible in L2 receipts and logs, but **your funds are not yet available on L1**.

2. **Finalize on L1** — you must explicitly call `finalize` to release your funds on L1.
   - This submits an L1 transaction.
   - Only after this step does your ETH or token balance increase on Ethereum.

## Why finalization matters

- **Funds remain locked** until finalization.
- **Anyone can finalize** — not just the withdrawer. In practice, most users will finalize their own withdrawals.
- **Finalization costs gas on L1**, so plan for this when withdrawing.

If you **forget to finalize**, your funds will stay in limbo: visible as “ready to withdraw,” but unavailable on Ethereum.

## SDK methods

- **`finalize(l2TxHash)`**  
  Actively sends the L1 transaction to finalize the withdrawal. Returns the updated `status` and the L1 receipt.

## Example: Explicit finalize

```ts
// Step 1: Create withdrawal on L2
const withdrawal = await sdk.withdrawals.create({
  token: ETH_ADDRESS,
  amount: parseEther('0.1'),
  to: myAddress,
});

// Step 2: Finalize on L1
await sdk.withdrawals.wait(withdrawal, { for: 'ready' }); // block until finalizable
const { status, receipt } = await sdk.withdrawals.finalize(withdrawal.l2TxHash);

console.log(status.phase); // "FINALIZED"
console.log(receipt?.transactionHash); // L1 finalize tx
```
