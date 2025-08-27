// import { ReadProvider } from "../interfaces";
// import { Address } from "../../types/primitives";
// import { encodeFunctionCall } from "../../internal/abi";

// export async function readBaseToken(
//   l1: ReadProvider,
//   bridgehub: Address,
//   chainId: bigint
// ): Promise<Address> {
//   const data = encodeFunctionCall('baseToken(uint256)', ['uint256'], [chainId]);
//   const raw = await l1.call({ to: bridgehub, data });
//   return (raw && raw !== '0x') ? (raw as Address) : ('0x0000000000000000000000000000000000000000' as Address);
// }

// export async function readBaseTokenAssetId(ctx: CoreContext, bridgehub: Address, chainId: bigint): Promise<string> {
//   const data = encodeFunctionCall(
//     'baseTokenAssetId(uint256)',
//     ['uint256'],
//     [chainId]
//   );
//   const raw = await ctx.l1.call({ to: bridgehub, data });
//   return raw ?? '0x';
// }
