// src/core/gas/types.ts

export type GasPolicyKey = string;

export type GasLayer = 'l1' | 'l2';

/** Basis points constant (10_000 == 100%). */
export const BPS = 10_000n;

/** Gas estimation and buffering policy for a given step. */
export interface GasPolicy {
  key: GasPolicyKey;
  layer: GasLayer;
  /** Buffer applied on top of the raw estimate (in basis points). */
  bufferBps: bigint;
  /** Optional hard minimum for the resulting gas value. */
  min?: bigint;
  /** Fallback value if estimation fails. */
  fallback?: bigint;
  /** Optional extra buffer for L1 base-cost calculations (in basis points). */
  baseCostBufferBps?: bigint;
}

export type GasPolicyStore = Record<GasPolicyKey, GasPolicy>;

export type GasPolicyOverrides = Record<GasPolicyKey, Partial<GasPolicy>>;

export type GasQuoteSource = 'estimate' | 'fallback' | 'none' | 'manual';

export interface GasQuote {
  key: GasPolicyKey;
  layer: GasLayer;
  rawEstimate?: bigint;
  recommended?: bigint;
  source: GasQuoteSource;
  policy: GasPolicy;
  diagnostics: string[];
}

export interface BaseCostQuote {
  key: GasPolicyKey;
  raw: bigint;
  /** Raw value after adding operator tip (if any). */
  withTip: bigint;
  /** Intermediate value after adding extras (e.g. L2 msg.value). */
  withExtras: bigint;
  /** Buffered amount to be paid on L1. */
  recommended: bigint;
  policy: GasPolicy;
  diagnostics: string[];
}

export interface GasPlannerHooks<Tx> {
  /** Estimate gas for the provided transaction on the requested layer. */
  estimate(layer: GasLayer, payload: Tx): Promise<bigint>;
}
