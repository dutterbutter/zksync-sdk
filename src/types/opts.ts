// types/opts.ts

// Options for SDK functions

export interface Opts {
  /** Abort long-running ops */
  signal?: AbortSignal;
  /** Hard timeout for waits / polling */
  timeoutMs?: number;
}
