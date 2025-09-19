# ZKsync `zks_` RPC Helpers

These helpers expose ZKsync-specific RPC methods through the SDK’s client.  
They work the same whether you’re using the **viem** or **ethers** adapter.

> In all examples below, assume you’ve already created a `client` (via `createViemClient` or `createEthersClient`).  
> Calls are identical across adapters: `client.zks.*`.

---

## `getBridgehubAddress()`

**What it does**  
Returns the canonical **Bridgehub** contract address.

**Example**

```ts
const bridgehub = await client.zks.getBridgehubAddress();
console.log('Bridgehub:', bridgehub); // 0x...
```

**Returns**
`Address` (EVM address string, `0x…`)

## `getReceiptWithL2ToL1(txHash)`

**What it does**
Fetches the transaction receipt for an **L2** tx and includes `l2ToL1Logs` as an array.
This makes it easy to locate L2→L1 messages without guessing the shape.

**Example**

```ts
const l2TxHash = '0x...'; // L2 transaction hash
const receipt = await client.zks.getReceiptWithL2ToL1(l2TxHash);

if (!receipt) {
  console.log('Receipt not found yet');
} else {
  console.log('l2ToL1Logs count:', receipt.l2ToL1Logs.length);
  // e.g. find the first L1MessageSent-like entry here if you need raw data
}
```

**Returns**
`ReceiptWithL2ToL1 | null`

- Same fields as a normal receipt, plus **`l2ToL1Logs: any[]`** (always present; empty if none).
- `null` when the node does not yet have the receipt.

## `getL2ToL1LogProof(txHash, index)`

**What it does**
Fetches the **proof** for an L2→L1 log at a given `index` in the transaction’s messenger logs.
The SDK normalizes the response to a consistent shape.

**Example**

```ts
const l2TxHash = '0x...';
const messengerLogIndex = 0; // whichever log index you intend to finalize

try {
  const proof = await client.zks.getL2ToL1LogProof(l2TxHash, messengerLogIndex);
  // proof.id, proof.batchNumber, proof.proof (Hex[])
  console.log('Proof id:', proof.id.toString());
  console.log('Batch number:', proof.batchNumber.toString());
  console.log('Proof length:', proof.proof.length);
} catch (e) {
  // If the proof is not yet available, the SDK raises a STATE error with a clear message.
  console.error('Proof unavailable yet or RPC error:', e);
}
```

**Returns**

```ts
type ProofNormalized = {
  id: bigint;
  batchNumber: bigint;
  proof: `0x${string}`[];
};
```
