// @ts-nocheck

import { describe, it, expect } from 'bun:test';
import { routeErc20NonBase } from '../erc20-nonbase';
import { isZKsyncError } from '../../../../../../core/types/errors';
import {
  IERC20,
  IBridgehub,
  ADDR,
  makeL1Provider,
  makeSigner,
  makeCtx,
  lower,
} from '../../../__tests__/deposits.testkit';

const K = {
  erc20Allowance: `${lower(ADDR.token)}|${IERC20.getFunction('allowance').selector.toLowerCase()}`,
  bhBaseCost: `${lower(ADDR.bridgehub)}|${IBridgehub.getFunction('l2TransactionBaseCost').selector.toLowerCase()}`,
};

describe('adapters/ethers/deposits/routeErc20NonBase.build', () => {
  it('uses MIN_L2_GAS (2_500_000) when ctx.l2GasLimit is undefined; no approval if allowance >= amount; gas bump 125%', async () => {
    const amount = 1_000n;
    const baseCost = 2_000n;
    const MIN = 2_500_000n;

    const mapping: Record<string, string> = {
      [K.erc20Allowance]: IERC20.encodeFunctionResult('allowance', [amount]),
      [K.bhBaseCost]: IBridgehub.encodeFunctionResult('l2TransactionBaseCost', [baseCost]),
    };
    const l1 = makeL1Provider(mapping, { estimateGas: 200_000n, expectBaseCostL2GasLimit: MIN });
    const signer = makeSigner(l1);

    const p = { token: ADDR.token as `0x${string}`, amount };
    const ctx = makeCtx(l1, signer); // l2GasLimit undefined → MIN used

    const res = await routeErc20NonBase().build(p as any, ctx as any);

    // No approvals
    expect(res.approvals.length).toBe(0);
    expect(res.steps.length).toBe(1);

    // Quote extras
    expect(res.quoteExtras.baseCost).toBe(baseCost);
    expect(res.quoteExtras.mintValue).toBe(baseCost + ctx.operatorTip);

    const bridge = res.steps[0];
    expect(bridge.key).toBe('bridgehub:two-bridges:nonbase');

    // 125% bump
    expect((bridge.tx as any).gasLimit).toBe((200_000n * 125n) / 100n);

    // Sanity: tx fields
    expect((bridge.tx as any).to.toLowerCase()).toBe(ADDR.bridgehub);
    const selTwo = IBridgehub.getFunction('requestL2TransactionTwoBridges').selector.toLowerCase();
    expect(((bridge.tx as any).data as string).toLowerCase().startsWith(selTwo)).toBe(true);
  });

  it('uses provided l2GasLimit if above MIN; encodes baseCost call with that value', async () => {
    const amount = 2_000n;
    const baseCost = 3_000n;
    const provided = 3_000_000n; // > MIN

    const mapping: Record<string, string> = {
      [K.erc20Allowance]: IERC20.encodeFunctionResult('allowance', [amount]),
      [K.bhBaseCost]: IBridgehub.encodeFunctionResult('l2TransactionBaseCost', [baseCost]),
    };
    const l1 = makeL1Provider(mapping, {
      estimateGas: 150_000n,
      expectBaseCostL2GasLimit: provided,
    });
    const signer = makeSigner(l1);

    const p = { token: ADDR.token as `0x${string}`, amount };
    const ctx = makeCtx(l1, signer, { l2GasLimit: provided });

    const res = await routeErc20NonBase().build(p as any, ctx as any);
    const bridge = res.steps[0];
    expect((bridge.tx as any).gasLimit).toBe((150_000n * 125n) / 100n);
  });

  it('clamps provided l2GasLimit up to MIN if below; still works', async () => {
    const amount = 2_000n;
    const baseCost = 3_000n;
    const provided = 1_000_000n; // < MIN → clamp to 2_500_000
    const MIN = 2_500_000n;

    const mapping: Record<string, string> = {
      [K.erc20Allowance]: IERC20.encodeFunctionResult('allowance', [amount]),
      [K.bhBaseCost]: IBridgehub.encodeFunctionResult('l2TransactionBaseCost', [baseCost]),
    };
    const l1 = makeL1Provider(mapping, {
      estimateGas: 180_000n,
      expectBaseCostL2GasLimit: MIN,
    });
    const signer = makeSigner(l1);

    const p = { token: ADDR.token as `0x${string}`, amount };
    const ctx = makeCtx(l1, signer, { l2GasLimit: provided });

    const res = await routeErc20NonBase().build(p as any, ctx as any);
    const bridge = res.steps[0];
    expect((bridge.tx as any).gasLimit).toBe((180_000n * 125n) / 100n);
  });

  it('adds approval & approve step when allowance < amount', async () => {
    const amount = 5_000n;
    const baseCost = 10_000n;

    const mapping: Record<string, string> = {
      [K.erc20Allowance]: IERC20.encodeFunctionResult('allowance', [amount - 1n]),
      [K.bhBaseCost]: IBridgehub.encodeFunctionResult('l2TransactionBaseCost', [baseCost]),
    };
    const l1 = makeL1Provider(mapping, { estimateGas: 100_000n });
    const signer = makeSigner(l1);

    const p = { token: ADDR.token as `0x${string}`, amount };
    const ctx = makeCtx(l1, signer);

    const res = await routeErc20NonBase().build(p as any, ctx as any);

    expect(res.approvals).toEqual([{ token: ADDR.token, spender: ADDR.assetRouter, amount }]);

    const approve = res.steps[0];
    expect(approve.kind).toBe('approve');
    expect((approve.tx as any).to.toLowerCase()).toBe(ADDR.token);
    const expectedData = IERC20.encodeFunctionData('approve', [ADDR.assetRouter, amount]);
    expect(((approve.tx as any).data as string).toLowerCase()).toBe(expectedData.toLowerCase());

    const bridge = res.steps[1];
    expect(bridge.key).toBe('bridgehub:two-bridges:nonbase');
  });

  it('estimateGas failure is ignored; build succeeds without gasLimit', async () => {
    const amount = 1_000n;
    const baseCost = 2_000n;

    const mapping: Record<string, string> = {
      [K.erc20Allowance]: IERC20.encodeFunctionResult('allowance', [amount]),
      [K.bhBaseCost]: IBridgehub.encodeFunctionResult('l2TransactionBaseCost', [baseCost]),
    };
    const l1 = makeL1Provider(mapping, { estimateGas: new Error('no gas') });
    const signer = makeSigner(l1);

    const p = { token: ADDR.token as `0x${string}`, amount };
    const ctx = makeCtx(l1, signer);

    const res = await routeErc20NonBase().build(p as any, ctx as any);
    const bridge = res.steps[0];
    expect((bridge.tx as any).gasLimit).toBeUndefined();
  });

  it('wraps allowance call errors as ZKsyncError (RPC)', async () => {
    const amount = 1_000n;
    const baseCost = 2_000n;

    // Missing allowance mapping triggers call error -> wrapAs('RPC', ...)
    const mapping: Record<string, string> = {
      [K.bhBaseCost]: IBridgehub.encodeFunctionResult('l2TransactionBaseCost', [baseCost]),
    };
    const l1 = makeL1Provider(mapping);
    const signer = makeSigner(l1);

    const p = { token: ADDR.token as `0x${string}`, amount };
    const ctx = makeCtx(l1, signer);

    let caught: unknown;
    try {
      await routeErc20NonBase().build(p as any, ctx as any);
      expect('should have thrown').toBe('but did not');
    } catch (e) {
      caught = e;
    }
    expect(isZKsyncError(caught)).toBe(true);
    expect(String(caught)).toMatch(/Failed to read ERC-20 allowance/);
  });

  it('wraps base cost call errors as ZKsyncError (RPC)', async () => {
    const amount = 1_000n;

    // Missing baseCost mapping → bh.l2TransactionBaseCost fails
    const mapping: Record<string, string> = {
      [K.erc20Allowance]: IERC20.encodeFunctionResult('allowance', [amount]),
    };
    const l1 = makeL1Provider(mapping);
    const signer = makeSigner(l1);

    const p = { token: ADDR.token as `0x${string}`, amount };
    const ctx = makeCtx(l1, signer);

    let caught: unknown;
    try {
      await routeErc20NonBase().build(p as any, ctx as any);
      expect('should have thrown').toBe('but did not');
    } catch (e) {
      caught = e;
    }
    expect(isZKsyncError(caught)).toBe(true);
    expect(String(caught)).toMatch(/Could not fetch L2 base cost from Bridgehub/);
  });

  it('preflight exists and resolves (no-op for now)', async () => {
    const l1 = makeL1Provider({}, {});
    const signer = makeSigner(l1);
    const ctx = makeCtx(l1, signer);
    await routeErc20NonBase().preflight?.({ token: ADDR.token, amount: 1n } as any, ctx as any);
    expect(true).toBe(true);
  });
});
