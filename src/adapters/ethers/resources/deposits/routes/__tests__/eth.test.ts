// @ts-nocheck

import { describe, it, expect } from 'bun:test';
import { routeEthDirect } from '../eth';
import { isZKsyncError } from '../../../../../../core/types/errors';
import {
  IBridgehub,
  ADDR,
  makeL1Provider,
  makeSigner,
  makeCtx,
  lower,
} from '../../../__tests__/deposits.testkit';

const K = {
  bhBaseCost: `${lower(ADDR.bridgehub)}|${IBridgehub.getFunction('l2TransactionBaseCost').selector.toLowerCase()}`,
};

describe('adapters/ethers/deposits/routeEthDirect.build', () => {
  it('happy path: computes mintValue, encodes direct call, bumps gasLimit by 115%', async () => {
    const amount = 1_234n;
    const baseCost = 2_000n;

    const mapping: Record<string, string> = {
      [K.bhBaseCost]: IBridgehub.encodeFunctionResult('l2TransactionBaseCost', [baseCost]),
    };
    const l1 = makeL1Provider(mapping, {
      estimateGas: 200_000n,
      expectBaseCostL2GasLimit: 600_000n,
    });
    const signer = makeSigner(l1);

    const p = { amount } as any; // ETH: tokenless; l2 destination defaults to sender
    const ctx = makeCtx(l1, signer);

    const res = await routeEthDirect().build(p, ctx);
    expect(res.approvals.length).toBe(0);
    expect(res.steps.length).toBe(1);

    // Quote extras
    const expectedMint = baseCost + ctx.operatorTip + amount;
    expect(res.quoteExtras.baseCost).toBe(baseCost);
    expect(res.quoteExtras.mintValue).toBe(expectedMint);

    const step = res.steps[0];
    expect(step.key).toBe('bridgehub:direct');
    expect(step.kind).toBe('bridgehub:direct');

    // Tx sanity
    const tx = step.tx as any;
    expect(tx.to.toLowerCase()).toBe(ADDR.bridgehub);
    expect(tx.from.toLowerCase()).toBe(ADDR.sender);
    expect(tx.value).toBe(expectedMint);
    expect(tx.gasLimit).toBe((200_000n * 115n) / 100n);

    // Data selector matches requestL2TransactionDirect
    const selDirect = IBridgehub.getFunction('requestL2TransactionDirect').selector.toLowerCase();
    expect((tx.data as string).toLowerCase().startsWith(selDirect)).toBe(true);

    // Decode the direct request and spot-check fields
    const decoded = IBridgehub.decodeFunctionData('requestL2TransactionDirect', tx.data);
    const req = decoded[0];
    // Depending on ABI name mapping, req may be array-like; normalize
    const reqObj = req as any;
    expect(BigInt(reqObj.chainId)).toBe(ctx.chainIdL2);
    expect(BigInt(reqObj.mintValue)).toBe(expectedMint);
    expect(BigInt(reqObj.l2GasLimit)).toBe(ctx.l2GasLimit);
    expect(reqObj.l2Contract.toLowerCase()).toBe(ctx.sender); // defaults to sender when p.to undefined
    expect(BigInt(reqObj.l2Value)).toBe(amount);
    expect(reqObj.refundRecipient.toLowerCase()).toBe(ctx.refundRecipient);
  });

  it('uses p.to as l2Contract when provided', async () => {
    const amount = 5_000n;
    const baseCost = 1_000n;

    const mapping: Record<string, string> = {
      [K.bhBaseCost]: IBridgehub.encodeFunctionResult('l2TransactionBaseCost', [baseCost]),
    };
    const l1 = makeL1Provider(mapping, {
      estimateGas: 120_000n,
      expectBaseCostL2GasLimit: 600_000n,
    });
    const signer = makeSigner(l1);

    const p = { to: ADDR.l2Contract, amount } as any;
    const ctx = makeCtx(l1, signer);

    const res = await routeEthDirect().build(p, ctx);
    const tx = res.steps[0].tx as any;

    const decoded = IBridgehub.decodeFunctionData('requestL2TransactionDirect', tx.data);
    const req = decoded[0] as any;

    expect(req.l2Contract.toLowerCase()).toBe(ADDR.l2Contract);
    expect(BigInt(req.l2Value)).toBe(amount);
    expect(res.quoteExtras.mintValue).toBe(baseCost + ctx.operatorTip + amount);
  });

  it('estimateGas failure is ignored; tx builds without gasLimit', async () => {
    const amount = 777n;
    const baseCost = 999n;

    const mapping: Record<string, string> = {
      [K.bhBaseCost]: IBridgehub.encodeFunctionResult('l2TransactionBaseCost', [baseCost]),
    };
    const l1 = makeL1Provider(mapping, {
      estimateGas: new Error('boom'),
      expectBaseCostL2GasLimit: 600_000n,
    });
    const signer = makeSigner(l1);

    const p = { amount } as any;
    const ctx = makeCtx(l1, signer);

    const res = await routeEthDirect().build(p, ctx);
    const tx = res.steps[0].tx as any;
    expect(tx.gasLimit).toBeUndefined();
  });

  it('wraps base cost call errors as ZKsyncError (RPC)', async () => {
    const amount = 1_000n;

    // No mapping for l2TransactionBaseCost -> causes wrapped error
    const l1 = makeL1Provider({});
    const signer = makeSigner(l1);

    const p = { amount } as any;
    const ctx = makeCtx(l1, signer);

    let caught: unknown;
    try {
      await routeEthDirect().build(p, ctx);
      expect('should have thrown').toBe('but did not');
    } catch (e) {
      caught = e;
    }
    expect(isZKsyncError(caught)).toBe(true);
    expect(String(caught)).toMatch(/Could not fetch L2 base cost from Bridgehub/);
  });
});
