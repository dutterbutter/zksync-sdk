import type { BundleInput } from '@zksync-sdk/core';

export function computeMsgValue(items: BundleInput['items']): bigint {
  let total = 0n;
  for (const it of items) {
    const item = it as
      | { kind: 'nativeTransfer'; amount: bigint }
      | { kind: 'remoteCall'; value?: bigint };

    if (item.kind === 'nativeTransfer') total += item.amount;
    if (item.kind === 'remoteCall' && item.value) total += item.value;
  }
  return total;
}
