# Concepts

This section explains the small set of ideas you need to use the SDK confidently. Keep these in mind as you read the guides and API reference.

## What’s here

- **[Status vs Wait](status-vs-wait.md)**  
  When to take a quick, non-blocking snapshot (`status`) vs when to block until a checkpoint (`wait`).  
  Covers deposit phases (`L1_PENDING → L2_EXECUTED/FAILED`) and withdrawal phases (`L2_PENDING → READY_TO_FINALIZE → FINALIZED`), polling options, and return shapes.

- **[Finalization](finalization.md)**  
  Withdrawals are **two-step**: initiate on L2, then **you must call `finalize` on L1** to release funds.  
  Explains readiness, how to detect `READY_TO_FINALIZE`, and how to use `finalize`.
