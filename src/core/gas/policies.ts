// src/core/gas/policies.ts

import type { GasPolicy, GasPolicyOverrides, GasPolicyStore } from './types';

export const DEFAULT_GAS_POLICIES: GasPolicyStore = {
  'withdraw.eth-base.l2': {
    key: 'withdraw.eth-base.l2',
    layer: 'l2',
    bufferBps: 1500n,
  },
  'withdraw.eth-nonbase.l2': {
    key: 'withdraw.eth-nonbase.l2',
    layer: 'l2',
    bufferBps: 1500n,
  },
  'withdraw.erc20-nonbase.l2': {
    key: 'withdraw.erc20-nonbase.l2',
    layer: 'l2',
    bufferBps: 1500n,
  },
  'withdraw.approval.l2': {
    key: 'withdraw.approval.l2',
    layer: 'l2',
    bufferBps: 1000n,
  },
  'deposit.bridgehub.direct.l1': {
    key: 'deposit.bridgehub.direct.l1',
    layer: 'l1',
    bufferBps: 1500n,
  },
  'deposit.bridgehub.two-bridges.eth-nonbase.l1': {
    key: 'deposit.bridgehub.two-bridges.eth-nonbase.l1',
    layer: 'l1',
    bufferBps: 1500n,
  },
  'deposit.bridgehub.two-bridges.erc20.l1': {
    key: 'deposit.bridgehub.two-bridges.erc20.l1',
    layer: 'l1',
    bufferBps: 2500n,
  },
  'deposit.approval.l1': {
    key: 'deposit.approval.l1',
    layer: 'l1',
    bufferBps: 1000n,
  },
  'deposit.l2.call.default': {
    key: 'deposit.l2.call.default',
    layer: 'l2',
    bufferBps: 1500n,
  },
  'deposit.l2.call.erc20-nonbase': {
    key: 'deposit.l2.call.erc20-nonbase',
    layer: 'l2',
    bufferBps: 1500n,
    min: 2_500_000n,
  },
  'deposit.base-cost.eth-base': {
    key: 'deposit.base-cost.eth-base',
    layer: 'l1',
    bufferBps: 0n,
  },
  'deposit.base-cost.erc20-base': {
    key: 'deposit.base-cost.erc20-base',
    layer: 'l1',
    bufferBps: 0n,
    baseCostBufferBps: 100n,
  },
  'deposit.base-cost.eth-nonbase': {
    key: 'deposit.base-cost.eth-nonbase',
    layer: 'l1',
    bufferBps: 0n,
    baseCostBufferBps: 100n,
  },
  'deposit.base-cost.erc20-nonbase': {
    key: 'deposit.base-cost.erc20-nonbase',
    layer: 'l1',
    bufferBps: 0n,
  },
};

export function mergePolicies(
  base: GasPolicyStore,
  overrides?: GasPolicyOverrides,
): GasPolicyStore {
  if (!overrides) return base;
  const merged: GasPolicyStore = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    const existing = merged[key];
    if (existing) {
      merged[key] = { ...existing, ...value, key: existing.key };
    } else if (value.layer != null && value.bufferBps != null) {
      merged[key] = {
        ...(value as GasPolicy),
        key: key,
      };
    }
  }
  return merged;
}
