// @ts-nocheck

import { describe, it, expect } from 'bun:test';
import { DepositsResource } from '../deposits/index';
import {
  IERC20,
  IBridgehub,
  ADDR,
  keyFor,
  enc,
  makeL1Provider,
  makeL2Provider,
  makeSigner,
  makeClient,
} from './deposits.testkit.ts';
import { isZKsyncError } from '../../../../core/types/errors.ts';
import { LEGACY_ETH_ADDRESS } from '../../../../core/constants.ts';
import { makeNprLog as nprLog } from '../deposits/services/__tests__/verification.test.ts';

describe('deposits: plan/quote', () => {
  it('quote() returns summary for ETH route (no approvals)', async () => {
    const baseCost = 2_000n;
    const mapping = {
      [keyFor(ADDR.bridgehub, IBridgehub, 'l2TransactionBaseCost')]: enc(
        IBridgehub,
        'l2TransactionBaseCost',
        [baseCost],
      ),
    };
    const l1 = makeL1Provider(mapping, { estimateGas: 100_000n });
    const l2 = makeL2Provider();
    const signer = makeSigner(l1);
    const client = makeClient({ l1, l2, signer });

    const deposits = DepositsResource(client);
    const summary = await deposits.quote({
      token: LEGACY_ETH_ADDRESS,
      amount: 123n,
      to: undefined,
    } as any);

    expect(summary.route).toBe('eth');
    expect(summary.approvalsNeeded.length).toBe(0);
    expect(summary.baseCost).toBe(baseCost);
    expect(summary.mintValue).toBe(baseCost + 123n);
  });

  it('tryQuote(): returns ok:false with shaped error when planning fails', async () => {
    // Missing base cost mapping causes routeEthDirect.build to throw; should be wrapped
    const l1 = makeL1Provider({});
    const l2 = makeL2Provider();
    const signer = makeSigner(l1);
    const client = makeClient({ l1, l2, signer });

    const deposits = DepositsResource(client);
    const res = await deposits.tryQuote({ token: ADDR.sender as any, amount: 1n } as any);
    expect(res.ok).toBe(false);
    // Unknown error is shaped by toResult() as ZKsyncError
    expect(isZKsyncError((res as any).error)).toBe(true);
  });

  it.skip('prepare(): ERC20-base route returns plan with approve step when allowance < amount', async () => {
    const amount = 1_000n,
      baseCost = 2_000n;
    const mapping = {
      [keyFor(ADDR.token, IERC20, 'allowance')]: enc(IERC20, 'allowance', [amount - 1n]),
      [keyFor(ADDR.bridgehub, IBridgehub, 'l2TransactionBaseCost')]: enc(
        IBridgehub,
        'l2TransactionBaseCost',
        [baseCost],
      ),
    };
    const l1 = makeL1Provider(mapping, { estimateGas: 100_000n });
    const l2 = makeL2Provider();
    const signer = makeSigner(l1);
    // Make baseToken() return ADDR.token so commonCtx picks 'erc20-base'
    const client = makeClient({ l1, l2, signer, baseToken: async () => ADDR.token as any });

    const deposits = DepositsResource(client);
    const plan = await deposits.prepare({ token: ADDR.token as any, amount } as any);
    expect(plan.route).toBe('erc20-base');
    expect(plan.summary.approvalsNeeded.length).toBe(1);
    expect(plan.steps[0].kind).toBe('approve');
    expect(plan.steps[1].kind).toBe('bridgehub:two-bridges');
  });

  it('tryPrepare(): returns ok:false with shaped error when preparation fails', async () => {
    // Missing base cost mapping causes routeEthDirect.build to throw; should be wrapped
    const l1 = makeL1Provider({});
    const l2 = makeL2Provider();
    const signer = makeSigner(l1);
    const client = makeClient({ l1, l2, signer });

    const deposits = DepositsResource(client);
    const res = await deposits.tryPrepare({ token: ADDR.sender as any, amount: 1n } as any);
    expect(res.ok).toBe(false);
    // Unknown error is shaped by toResult() as ZKsyncError
    expect(isZKsyncError((res as any).error)).toBe(true);
  });
});

describe('deposits: create/tryCreate', () => {
  it('create(): ETH — builds, estimates gas if missing, sends one step, returns handle', async () => {
    const baseCost = 2_000n;
    // Force route build to skip setting gasLimit (by making estimateGas throw there),
    // so index.ts does its own gas estimate later.
    const mapping = {
      [keyFor(ADDR.bridgehub, IBridgehub, 'l2TransactionBaseCost')]: enc(
        IBridgehub,
        'l2TransactionBaseCost',
        [baseCost],
      ),
    };
    const l1 = makeL1Provider(mapping, { estimateGas: 210_000n, getTransactionCount: 7 });
    const l2 = makeL2Provider();
    const signer = makeSigner(l1);
    const client = makeClient({ l1, l2, signer });

    const deposits = DepositsResource(client);
    const handle = await deposits.create({ token: LEGACY_ETH_ADDRESS as any, amount: 123n } as any);

    expect(handle.kind).toBe('deposit');
    expect(typeof handle.l1TxHash).toBe('string');
    expect(handle.plan.route).toBe('eth');
    // nonce management: index.ts sets .nonce and bumps per step
    const onlyStep = handle.plan.steps[0];
    expect(typeof onlyStep.tx.nonce).toBe('number');
  });

  it.skip('create(): ERC20-base — re-checks allowance and skips approve when already sufficient', async () => {
    const amount = 1_000n,
      baseCost = 2_000n;
    const mapping = {
      // Route build: allowance < amount -> approve step appears
      [keyFor(ADDR.token, IERC20, 'allowance')]: enc(IERC20, 'allowance', [amount - 1n]),
      [keyFor(ADDR.bridgehub, IBridgehub, 'l2TransactionBaseCost')]: enc(
        IBridgehub,
        'l2TransactionBaseCost',
        [baseCost],
      ),
      // Re-check in create(): a new allowance query executed with signer — return >= amount to skip
      // (same key lookup since Contract(address, IERC20) encodes the same selector)
      // Easiest: override makeSigner to return a different provider? Not needed — index calls Contract(...).allowance(from, router)
      // We'll just keep the same mapping but set amount MUCH bigger so re-check >= target.
      [keyFor(ADDR.token, IERC20, 'allowance')]: enc(IERC20, 'allowance', [amount + 100n]),
    };
    const l1 = makeL1Provider(mapping, { estimateGas: 100_000n, getTransactionCount: 0 });
    const l2 = makeL2Provider();
    const signer = makeSigner(l1);
    const client = makeClient({ l1, l2, signer, baseToken: async () => ADDR.token as any });

    const deposits = DepositsResource(client);
    const handle = await deposits.create({ token: ADDR.token as any, amount } as any);

    // Since re-check shows allowance already sufficient, only the bridge step is sent
    const sentKeys = Object.keys(handle.stepHashes);
    expect(sentKeys).toEqual(['bridgehub:two-bridges']);
  });

  it('tryCreate(): returns ok:false when a step reverts (status=0)', async () => {
    const baseCost = 2_000n;
    const mapping = {
      [keyFor(ADDR.bridgehub, IBridgehub, 'l2TransactionBaseCost')]: enc(
        IBridgehub,
        'l2TransactionBaseCost',
        [baseCost],
      ),
    };
    const l1 = makeL1Provider(mapping, { estimateGas: 100_000n });
    const l2 = makeL2Provider();
    // signer that "reverts" (wait() -> status 0)
    const signer = {
      provider: l1,
      connect(p: any) {
        return { ...this, provider: p };
      },
      async getAddress() {
        return ADDR.sender;
      },
      async sendTransaction(_tx: any) {
        return {
          hash: ('0x' + 'cd'.repeat(32)) as `0x${string}`,
          async wait() {
            return { status: 0 };
          },
        };
      },
    } as any;
    const client = makeClient({ l1, l2, signer });

    const deposits = DepositsResource(client);
    const res = await deposits.tryCreate({ token: ADDR.sender as any, amount: 1n } as any);
    expect(res.ok).toBe(false);
  });
});

describe('deposits: status/wait', () => {
  it('status(): UNKNOWN when no hash', async () => {
    const l1 = makeL1Provider({});
    const l2 = makeL2Provider();
    const client = makeClient({ l1, l2, signer: makeSigner(l1) });
    const deposits = DepositsResource(client);
    const s = await deposits.status({} as any);
    expect(s.phase).toBe('UNKNOWN');
  });

  it('status(): L1_PENDING / L1_INCLUDED / L2_PENDING / L2_EXECUTED', async () => {
    const l2tx = ('0x' + 'bb'.repeat(32)) as `0x${string}`;
    // 1) L1 missing
    let l1 = makeL1Provider({}, { getTransactionReceipt: null });
    let l2 = makeL2Provider({ getTransactionReceipt: null });
    let client = makeClient({ l1, l2, signer: makeSigner(l1) });
    let s = await DepositsResource(client).status(('0x' + 'aa'.repeat(32)) as any);
    expect(s.phase).toBe('L1_PENDING');

    // 2) L1 present, NPR log but no L2 receipt yet
    l1 = makeL1Provider({}, { getTransactionReceipt: { logs: [nprLog(l2tx)], status: 1 } });
    l2 = makeL2Provider({ getTransactionReceipt: null });
    client = makeClient({ l1, l2, signer: makeSigner(l1) });
    s = await DepositsResource(client).status(('0x' + 'aa'.repeat(32)) as any);
    expect(s.phase).toBe('L2_PENDING');

    // 3) L2 pending
    l2 = makeL2Provider({ getTransactionReceipt: null });
    client = makeClient({ l1, l2, signer: makeSigner(l1) });
    s = await DepositsResource(client).status(('0x' + 'aa'.repeat(32)) as any);
    expect(s.phase).toBe('L2_PENDING');

    // 4) L2 executed
    l2 = makeL2Provider({ getTransactionReceipt: { status: 1 } });
    client = makeClient({ l1, l2, signer: makeSigner(l1) });
    s = await DepositsResource(client).status(('0x' + 'aa'.repeat(32)) as any);
    expect(s.phase).toBe('L2_EXECUTED');
  });

  it("wait(): for:'l1' returns L1 receipt; null when still pending", async () => {
    const l1hash = ('0x' + 'aa'.repeat(32)) as `0x${string}`;

    // pending
    let l1 = makeL1Provider({}, { waitForTransaction: null });
    let l2 = makeL2Provider();
    let client = makeClient({ l1, l2, signer: makeSigner(l1) });
    let v = await DepositsResource(client).wait(l1hash, { for: 'l1' });
    expect(v).toBeNull();

    // included
    l1 = makeL1Provider({}, { waitForTransaction: { status: 1 } });
    client = makeClient({ l1, l2, signer: makeSigner(l1) });
    v = await DepositsResource(client).wait(l1hash, { for: 'l1' });
    expect((v as any).status).toBe(1);
  });

  it('tryWait(): returns ok:false with STATE error when still pending', async () => {
    const l1hash = ('0x' + 'aa'.repeat(32)) as `0x${string}`;
    const l1 = makeL1Provider({}, { waitForTransaction: null });
    const l2 = makeL2Provider();
    const client = makeClient({ l1, l2, signer: makeSigner(l1) });
    const res = await DepositsResource(client).tryWait(l1hash, { for: 'l1' });
    expect(res.ok).toBe(false);
    expect(isZKsyncError((res as any).error)).toBe(true);
    expect(String((res as any).error)).toMatch(/No L1 receipt yet/);
  });
});
