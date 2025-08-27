// import type { Address } from '../../types/primitives';
// import type { DepositParams, DepositQuote } from '../../types/deposits';
// import type { CoreContext } from '../context';
// import { AddressResolver } from '../address-resolver';
// import { getAllowance } from '../allowance';
// import { fetchBaseCost } from '../gas/base-cost';
// import { encodeFunctionCall } from '../../internal/abi';

// const ETH_SENTINEL = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'.toLowerCase();

// export async function quoteDeposit(
//   ctx: CoreContext,
//   params: DepositParams,
//   owner: Address
// ): Promise<DepositQuote> {
//   const resolver = new AddressResolver(ctx);
//   const bridgehub = resolver.l1Bridgehub('local');
//   const ntv = resolver.l1NativeTokenVault('local');

//   const chainId: bigint =
//     (await (ctx.l2 as any)?.getChainId?.()) ??
//     (await (ctx.l2 as any)?.getNetwork?.())?.chainId ??
//     BigInt((ctx.registry.resolve('local') as any)?.chainId ?? 0);

//   // Resolve chain base token from Bridgehub
//   const baseTokenCall = encodeFunctionCall('baseToken(uint256)', ['uint256'], [chainId]);
//   const rawBaseToken = await ctx.l1.call({ to: bridgehub, data: baseTokenCall });
//   const baseToken =
//     rawBaseToken && rawBaseToken !== '0x'
//       ? ('0x' + rawBaseToken.slice(26)).toLowerCase()
//       : ETH_SENTINEL;

//   const isETH = params.token.toLowerCase() === ETH_SENTINEL;
//   const isBaseETH = baseToken === ETH_SENTINEL;
//   const isTokenBase = params.token.toLowerCase() === baseToken;

//   const l2GasLimit = params.l2GasLimit ?? 200_000n;
//   const gasPerPubdata = params.gasPerPubdata ?? 800n;

//   // Base cost always applies (minted base token covers L2 execution)
//   const baseCost = await fetchBaseCost(ctx.l1, bridgehub, chainId, l2GasLimit, gasPerPubdata);

//   const approvalsNeeded: { token: Address; spender: Address; amount: bigint }[] = [];

//   if (isETH && isBaseETH) {
//     // ETH on ETH-based chain: no approvals, msg.value will carry (baseCost + amount)
//   } else if (!isBaseETH && isTokenBase) {
//     // Base token is ERC20 & we’re depositing it → need approval for mintValue = baseCost + amount
//     const mintValue = baseCost + params.amount;
//     const allowance = await getAllowance(ctx.l1, params.token, owner, ntv);
//     if (allowance < mintValue) {
//       approvalsNeeded.push({ token: params.token, spender: ntv, amount: mintValue });
//     }
//   } else if (!isETH && !isTokenBase) {
//     // Non-base ERC20 via two-bridges:
//     // 1) Approve deposit token for `amount`
//     const depAllowance = await getAllowance(ctx.l1, params.token, owner, ntv);
//     if (depAllowance < params.amount) {
//       approvalsNeeded.push({ token: params.token, spender: ntv, amount: params.amount });
//     }
//     // 2) If base token is ERC20, also approve base token for `baseCost`
//     if (!isBaseETH) {
//       const baseAllowance = await getAllowance(ctx.l1, baseToken as Address, owner, ntv);
//       if (baseAllowance < baseCost) {
//         approvalsNeeded.push({ token: baseToken as Address, spender: ntv, amount: baseCost });
//       }
//     }
//   } else {
//     // ETH to a non-ETH-based chain is not supported by contracts.
//     // We still return a quote with no approvals; caller can surface a clear error earlier in plan step.
//   }

//   return {
//     route: isETH && isBaseETH ? 'ETH' : 'ERC20',
//     approvalsNeeded,
//     baseCost,
//     suggestedL2GasLimit: l2GasLimit,
//     gasPerPubdata,
//     minGasLimitApplied: true,
//     gasBufferPctApplied: 10
//   };
// }
