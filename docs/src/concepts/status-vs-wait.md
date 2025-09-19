# Status vs Wait

The SDK exposes two complementary ways to track progress:

- **`status(...)`** — returns a **non-blocking snapshot** of where an operation is.
- **`wait(..., { for })`** — **blocks/polls** until a specified checkpoint is reached.

Both methods work for **Deposits** and **Withdrawals**, but Withdrawals add finalization-specific states and targets.

## Withdrawals

### `withdrawals.status(h | l2TxHash) → Promise<WithdrawalStatus>`

**Input**

- `h`: a `WithdrawalWaitable` (e.g., from `create`) **or** the L2 tx hash `Hex`.

**Phases returned**

- `UNKNOWN` — no L2 hash available on the handle.
- `L2_PENDING` — L2 tx not yet included.
- `PENDING` — L2 included, but not yet ready to finalize.
- `READY_TO_FINALIZE` — finalization would succeed now.
- `FINALIZED` — finalized on L1 (funds released).

**Notes**

- When L2 receipt is missing → `L2_PENDING`.
- When finalization key can be derived but not ready → `PENDING`.
- When already finalized → `FINALIZED`.

**Example**

```ts
const s = await sdk.withdrawals.status(handleOrHash);
// s.phase in: 'UNKNOWN' | 'L2_PENDING' | 'PENDING' | 'READY_TO_FINALIZE' | 'FINALIZED'
```

### `withdrawals.wait(h | l2TxHash, { for, pollMs?, timeoutMs? })`

**Targets**

- `{ for: 'l2' }` → resolves with **L2 receipt** (`TransactionReceiptZKsyncOS | null`)
- `{ for: 'ready' }` → resolves **`null`** when finalization becomes possible
- `{ for: 'finalized' }` → resolves **L1 receipt** when finalized, or `null` if finalized but receipt not found

**Behavior**

- If the handle has **no L2 tx hash**, returns `null` immediately.
- Default polling interval: 5500ms default or set explicitly if you want.
- Optional `timeoutMs` returns `null` on deadline.

**Example**

```ts
// wait for inclusion on L2, get L2 receipt (augmented with l2ToL1Logs if available)
const l2Rcpt = await sdk.withdrawals.wait(handle, { for: 'l2', pollMs: 5000 });

// wait until it's available to finalize (no side-effects)
await sdk.withdrawals.wait(handle, { for: 'ready' });

// wait until finalized; returns L1 receipt (or null if finalized but receipt not retrievable)
const l1Rcpt = await sdk.withdrawals.wait(handle, { for: 'finalized' });
```

**Common Troubleshooting**

- Network hiccup while fetching receipts → thrown `ZKsyncError` (`RPC` kind).
- Internal decode issue → thrown `ZKsyncError` (`INTERNAL` kind).

---

## Deposits

### `deposits.status(h | l1TxHash) → Promise<DepositStatus>`

**Input**

- `h`: `DepositWaitable` (from `create`) **or** L1 tx hash `Hex`.

**Phases returned**

- `UNKNOWN` — no L1 hash.
- `L1_PENDING` — L1 receipt missing.
- `L1_INCLUDED` — L1 included, but L2 hash not yet derivable from logs.
- `L2_PENDING` — L2 hash known but receipt missing.
- `L2_EXECUTED` — L2 receipt present with `status === 1`.
- `L2_FAILED` — L2 receipt present with `status !== 1`.

**Example**

```ts
const s = await sdk.deposits.status(handleOrL1Hash);
// s.phase in: 'UNKNOWN' | 'L1_PENDING' | 'L1_INCLUDED' | 'L2_PENDING' | 'L2_EXECUTED' | 'L2_FAILED'
```

### `deposits.wait(h | l1TxHash, { for: 'l1' | 'l2' })`

**Targets**

- `{ for: 'l1' }` → waits for L1 inclusion → **L1 receipt** or `null`
- `{ for: 'l2' }` → waits L1 inclusion **and** canonical L2 execution → **L2 receipt** or `null`

**Example**

```ts
const l1Rcpt = await sdk.deposits.wait(handle, { for: 'l1' });
const l2Rcpt = await sdk.deposits.wait(handle, { for: 'l2' });
```

---

## Tips & edge cases

- **Handles vs hashes:** Both methods accept either a handle (from `create`) or a raw tx hash (`Hex`). If you pass a handle without the relevant hash, you’ll get `UNKNOWN`/`null`.
- **Polling:** For withdrawals, set `pollMs` explicitly if you want tighter/looser polling; minimum enforced is **5500ms**.
- **Timeouts:** Use `timeoutMs` for long waits (e.g., finalization windows) to avoid hanging scripts.
