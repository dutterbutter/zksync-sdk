// import type { Address } from '../../types/primitives';
// import type { DepositParams, DepositPlan } from '../../types/deposits';
// import type { CoreContext } from '../context';
// import { AddressResolver } from '../address-resolver';
// import { encodeFunctionCall } from '../../internal/abi';
// import { buildTx } from '../../internal/evm';
// import { planApproveExact } from '../allowance';

// /**
//  * Build the deposit transactions (approvals + deposit).
//  */
// export async function planDeposit(
//   ctx: CoreContext,
//   params: DepositParams,
//   owner: Address
// ): Promise<DepositPlan> {
//   const resolver = new AddressResolver(ctx);
//   const preTxs = [];

//   let depositTx;

//   if (params.token === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
//     // ETH deposit via Bridgehub
//     const bridgehub = resolver.l1Bridgehub('local');
//     const data = encodeFunctionCall(
//       'deposit(address,uint256,uint256)',
//       ['address','uint256','uint256'],
//       [params.to ?? owner, params.l2GasLimit ?? 200_000n, params.gasPerPubdata ?? 800n]
//     );
//     depositTx = buildTx(bridgehub, data, params.amount);
//   } else {
//     // ERC20 deposit via AssetRouter
//     const router = resolver.l1AssetRouter('local');
//     const approve = planApproveExact(params.token, router, params.amount);
//     preTxs.push(approve);
//     const data = encodeFunctionCall(
//       'deposit(address,address,uint256,uint256,uint256)',
//       ['address','address','uint256','uint256','uint256'],
//       [params.token, params.to ?? owner, params.amount, params.l2GasLimit ?? 200_000n, params.gasPerPubdata ?? 800n]
//     );
//     depositTx = buildTx(router, data);
//   }

//   return { preTxs, depositTx };
// }
