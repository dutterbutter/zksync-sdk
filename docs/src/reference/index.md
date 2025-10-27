# Reference

This section documents the **low-level APIs** exposed by the SDK.  
Unlike the high-level flows (`deposits`, `withdrawals`), these helpers give you direct access to ZKsync-specific contracts and RPC methods.

## What you’ll find here

- **ZKsync RPC Helpers**  
  A typed interface around ZKsync `zks_` JSON-RPC methods such as:
  - `getBridgehubAddress()`
  - `getL2ToL1LogProof()`
  - `getReceiptWithL2ToL1()`
  - `getGenesis()`

- **Common Helpers**  
  Utility getters for frequently used contracts and addresses, such as:
  - `l1AssetRouter()`, `l1Nullifier()`, `l1NativeTokenVault()`
  - `baseToken(chainId)`
  - `l1TokenAddress(l2Token)`, `l2TokenAddress(l1Token)`
  - `assetId(l1Token)`
