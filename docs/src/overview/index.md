# Overview

The `@zksync-sdk` is a lightweight extension for `viem` and `ethers` that makes ZKsync cross-chain actions simple and consistent.

Instead of re-implementing accounts or RPC logic, this SDK focuses only on **ZKsync-specific flows**:

- Deposits (L1 → L2)
- Withdrawals (L2 → L1, with finalization)
- Status & wait helpers
- ZKsync specific JSON-RPC methods

## What you’ll find here

- [**What this SDK does**](what-it-does.md) — the purpose, scope, and non-goals.  
- [**Mental model**](mental-model.md) — how to think about the core methods (`quote → prepare → create → status → wait → finalize`).  
- [**Adapters (viem & ethers)**](adapters.md) — how the SDK integrates with your existing stack.

## Next steps

👉 If you want to get hands-on right away, jump to the [Quickstart](../quickstart/index.md).
