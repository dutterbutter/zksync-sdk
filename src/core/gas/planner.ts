// src/core/gas/planner.ts

import type {
  BaseCostQuote,
  GasPolicy,
  GasPolicyKey,
  GasPolicyOverrides,
  GasPolicyStore,
  GasQuote,
  GasQuoteSource,
} from './types';
import { BPS } from './types';
import { mergePolicies } from './policies';

export interface EnsureOptions<Tx> {
  estimator?: (payload: Tx) => Promise<bigint>;
  overrides?: Partial<GasPolicy>;
}

export interface BaseCostOptions {
  operatorTip?: bigint;
  extras?: bigint;
  overrides?: Partial<GasPolicy>;
}

export interface GasPlannerSnapshot {
  gasQuotes: Record<string, GasQuote>;
  baseCosts: Record<string, BaseCostQuote>;
}

function applyBuffer(value: bigint, bufferBps: bigint): bigint {
  if (bufferBps === 0n) return value;
  return (value * (BPS + bufferBps)) / BPS;
}

function mergePolicy(
  store: GasPolicyStore,
  key: GasPolicyKey,
  overrides?: Partial<GasPolicy>,
): GasPolicy {
  const base = store[key];
  if (!base) {
    throw new Error(`Missing gas policy for key: ${key}`);
  }
  return { ...base, ...overrides, key: base.key };
}

export class GasPlanner<Tx> {
  private readonly policies: GasPolicyStore;
  private readonly quotes = new Map<string, GasQuote>();
  private readonly baseCosts = new Map<string, BaseCostQuote>();

  constructor(basePolicies: GasPolicyStore, overrides?: GasPolicyOverrides) {
    this.policies = mergePolicies(basePolicies, overrides);
  }

  async ensure(
    stepKey: string,
    policyKey: GasPolicyKey,
    payload: Tx,
    opts: EnsureOptions<Tx> = {},
  ): Promise<GasQuote> {
    const policy = mergePolicy(this.policies, policyKey, opts.overrides);
    const diagnostics: string[] = [];

    let raw: bigint | undefined;
    let source: GasQuoteSource = 'none';

    if (opts.estimator) {
      try {
        raw = await opts.estimator(payload);
        source = 'estimate';
      } catch (err) {
        diagnostics.push(`estimation failed: ${(err as Error).message ?? 'unknown error'}`);
      }
    }

    let recommended: bigint | undefined;

    if (raw != null) {
      recommended = applyBuffer(raw, policy.bufferBps);
    } else if (policy.fallback != null) {
      recommended = policy.fallback;
      if (source === 'none') source = 'fallback';
    }

    if (recommended != null && policy.min != null && recommended < policy.min) {
      diagnostics.push(`raised to policy min ${policy.min.toString()}`);
      recommended = policy.min;
    }

    const quote: GasQuote = {
      key: policy.key,
      layer: policy.layer,
      rawEstimate: raw,
      recommended,
      source,
      policy,
      diagnostics,
    };

    this.quotes.set(stepKey, quote);
    return quote;
  }

  applyBaseCost(
    refKey: string,
    policyKey: GasPolicyKey,
    rawBaseCost: bigint,
    opts: BaseCostOptions = {},
  ): BaseCostQuote {
    const policy = mergePolicy(this.policies, policyKey, opts.overrides);
    const diagnostics: string[] = [];

    const withTip = rawBaseCost + (opts.operatorTip ?? 0n);
    const withExtras = withTip + (opts.extras ?? 0n);

    let recommended = withExtras;

    if (policy.baseCostBufferBps != null && policy.baseCostBufferBps > 0n) {
      recommended = applyBuffer(recommended, policy.baseCostBufferBps);
    }

    if (policy.min != null && recommended < policy.min) {
      diagnostics.push(`raised to policy min ${policy.min.toString()}`);
      recommended = policy.min;
    }

    const quote: BaseCostQuote = {
      key: policy.key,
      raw: rawBaseCost,
      withTip,
      withExtras,
      recommended,
      policy,
      diagnostics,
    };

    this.baseCosts.set(refKey, quote);
    return quote;
  }

  /** Snapshot collected gas/base-cost decisions for inclusion in quotes. */
  snapshot(): GasPlannerSnapshot {
    const gasQuotes: Record<string, GasQuote> = {};
    const baseCosts: Record<string, BaseCostQuote> = {};

    for (const [stepKey, quote] of this.quotes.entries()) {
      gasQuotes[stepKey] = quote;
    }
    for (const [refKey, quote] of this.baseCosts.entries()) {
      baseCosts[refKey] = quote;
    }

    return { gasQuotes, baseCosts };
  }

  /** Retrieve the suggested gas value for a previously recorded step. */
  get(stepKey: string): GasQuote | undefined {
    return this.quotes.get(stepKey);
  }
}
