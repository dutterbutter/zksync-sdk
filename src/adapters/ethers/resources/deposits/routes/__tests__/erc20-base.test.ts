// // @ts-nocheck

// import { describe, it, expect } from 'bun:test';
// import { routeErc20Base } from '../erc20-base';
// import { isZKsyncError } from '../../../../../../core/types/errors';
// import {
//   IERC20,
//   IBridgehub,
//   ADDR,
//   makeL1Provider,
//   makeSigner,
//   makeCtx,
//   lower,
// } from '../../../__tests__/deposits.testkit';

// const K = {
//   erc20Allowance: `${lower(ADDR.token)}|${IERC20.getFunction('allowance').selector.toLowerCase()}`,
//   bhBaseCost: `${lower(ADDR.bridgehub)}|${IBridgehub.getFunction('l2TransactionBaseCost').selector.toLowerCase()}`,
// };

// describe('adapters/ethers/deposits/routeErc20Base.build', () => {
//   it('no approval when allowance >= amount; computes mintValue=baseCost+operatorTip; builds bridge step', async () => {
//     const amount = 1_000n;
//     const baseCost = 2_000n;

//     const mapping: Record<string, string> = {
//       [K.erc20Allowance]: IERC20.encodeFunctionResult('allowance', [amount]),
//       [K.bhBaseCost]: IBridgehub.encodeFunctionResult('l2TransactionBaseCost', [baseCost]),
//     };
//     const l1 = makeL1Provider(mapping, { estimateGas: 120_000n });
//     const signer = makeSigner(l1);

//     const p = { token: ADDR.token as `0x${string}`, amount };
//     const ctx = makeCtx(l1, signer);

//     const res = await routeErc20Base().build(p as any, ctx as any);
//     expect(res.approvals.length).toBe(0);
//     expect(res.steps.length).toBe(1);

//     // Quote extras
//     expect(res.quoteExtras.baseCost).toBe(baseCost);
//     expect(res.quoteExtras.mintValue).toBe(baseCost + ctx.operatorTip);

//     const bridge = res.steps[0];
//     expect(bridge.key).toBe('bridgehub:two-bridges');
//     expect((bridge.tx as any).to.toLowerCase()).toBe(ADDR.bridgehub);
//     expect((bridge.tx as any).from.toLowerCase()).toBe(ADDR.sender);
//     expect((bridge.tx as any).value).toBe(baseCost + ctx.operatorTip);

//     // Bridge data starts with requestL2TransactionTwoBridges selector
//     const selTwo = IBridgehub.getFunction('requestL2TransactionTwoBridges').selector.toLowerCase();
//     expect(((bridge.tx as any).data as string).toLowerCase().startsWith(selTwo)).toBe(true);

//     // gasLimit set to 115% of estimate
//     expect((bridge.tx as any).gasLimit).toBe((120_000n * 115n) / 100n);
//   });

//   it('adds approval & approve step when allowance < amount', async () => {
//     const amount = 5_000n;
//     const baseCost = 10_000n;

//     const mapping: Record<string, string> = {
//       [K.erc20Allowance]: IERC20.encodeFunctionResult('allowance', [amount - 1n]),
//       [K.bhBaseCost]: IBridgehub.encodeFunctionResult('l2TransactionBaseCost', [baseCost]),
//     };
//     const l1 = makeL1Provider(mapping, { estimateGas: 100_000n });
//     const signer = makeSigner(l1);

//     const p = { token: ADDR.token as `0x${string}`, amount };
//     const ctx = makeCtx(l1, signer);

//     const res = await routeErc20Base().build(p as any, ctx as any);

//     expect(res.approvals).toEqual([{ token: ADDR.token, spender: ADDR.assetRouter, amount }]);

//     const approve = res.steps[0];
//     expect(approve.kind).toBe('approve');
//     expect((approve.tx as any).to.toLowerCase()).toBe(ADDR.token);
//     const expectedData = IERC20.encodeFunctionData('approve', [ADDR.assetRouter, amount]);
//     expect(((approve.tx as any).data as string).toLowerCase()).toBe(expectedData.toLowerCase());

//     const bridge = res.steps[1];
//     expect(bridge.key).toBe('bridgehub:two-bridges');
//   });

//   it('estimateGas failure is ignored; build still succeeds without gasLimit', async () => {
//     const amount = 1_000n;
//     const baseCost = 2_000n;

//     const mapping: Record<string, string> = {
//       [K.erc20Allowance]: IERC20.encodeFunctionResult('allowance', [amount]),
//       [K.bhBaseCost]: IBridgehub.encodeFunctionResult('l2TransactionBaseCost', [baseCost]),
//     };
//     const l1 = makeL1Provider(mapping, { estimateGas: new Error('no gas') });
//     const signer = makeSigner(l1);

//     const p = { token: ADDR.token as `0x${string}`, amount };
//     const ctx = makeCtx(l1, signer);

//     const res = await routeErc20Base().build(p as any, ctx as any);
//     const bridge = res.steps[0];
//     expect((bridge.tx as any).gasLimit).toBeUndefined();
//     expect(res.quoteExtras.mintValue).toBe(baseCost + ctx.operatorTip);
//   });

//   it('wraps allowance call errors as ZKsyncError (RPC)', async () => {
//     const amount = 1_000n;
//     const baseCost = 2_000n;

//     const mapping: Record<string, string> = {
//       [K.bhBaseCost]: IBridgehub.encodeFunctionResult('l2TransactionBaseCost', [baseCost]),
//     };
//     const l1 = makeL1Provider(mapping);
//     const signer = makeSigner(l1);

//     const p = { token: ADDR.token as `0x${string}`, amount };
//     const ctx = makeCtx(l1, signer);

//     let caught: unknown;
//     try {
//       await routeErc20Base().build(p as any, ctx as any);
//       expect('should have thrown').toBe('but did not');
//     } catch (e) {
//       caught = e;
//     }

//     expect(isZKsyncError(caught)).toBe(true);
//     expect(String(caught)).toMatch(/Failed to read ERC-20 allowance/);
//   });
// });
