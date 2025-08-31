// src/adapters/ethers/resources/helpers.ts
import { Contract, AbiCoder, type TransactionRequest } from 'ethers';
import type { EthersClient } from '../client';
import type { Address,UInt } from '../../../types/primitives';
import { ETH_ADDRESS, ETH_ADDRESS_IN_CONTRACTS, L2_ETH_ADDRESS } from '../../../types/primitives';
import type { DepositRoute } from '../../../types/deposits';
import IBridgehubABI from "../../../internal/abis/IBridgehub.json" assert { type: "json" };

// --- Token utils ---
export function isEth(token: Address): boolean {
  const t = token.toLowerCase();
  return t === ETH_ADDRESS || t === ETH_ADDRESS_IN_CONTRACTS || t === L2_ETH_ADDRESS;
}

// --- Bridgehub getters ---
export async function resolveBaseToken(
  client: EthersClient,
  bridgehub: Address,
  chainId: UInt,
): Promise<Address> {
  const bh = new Contract(bridgehub, IBridgehubABI, client.l1);
  return (await bh.baseToken(chainId)) as Address;
}

// export async function resolveAssetRouter(
//   client: EthersClient,
//   bridgehub: Address,
// ): Promise<Address> {
//   const bh = new Contract(bridgehub, IBridgehubAbi, client.l1);
//   return (await bh.assetRouter()) as Address; // no chainId arg in your ABI
// }

// --- Gas + fees ---
export async function getFeeOverrides(
  client: EthersClient,
): Promise<Partial<TransactionRequest> & { gasPriceForBaseCost: bigint }> {
  const fd = await client.l1.getFeeData();
  const use1559 = fd.maxFeePerGas != null && fd.maxPriorityFeePerGas != null;
  const feeOverrides = use1559
    ? { maxFeePerGas: fd.maxFeePerGas, maxPriorityFeePerGas: fd.maxPriorityFeePerGas }
    : { gasPrice: fd.gasPrice };

  const gasPriceForBaseCostBn = fd.gasPrice ?? fd.maxFeePerGas;
  if (gasPriceForBaseCostBn == null) throw new Error('provider returned no gas price data');

  return { ...feeOverrides, gasPriceForBaseCost: BigInt(gasPriceForBaseCostBn.toString()) };
}

export async function getGasPriceWei(client: EthersClient): Promise<bigint> {
  // prefer FeeData.gasPrice if available; fallback to FeeData.maxFeePerGas
  const fd = await client.l1.getFeeData();
  if (fd.gasPrice != null) return BigInt(fd.gasPrice.toString());
  if (fd.maxFeePerGas != null) return BigInt(fd.maxFeePerGas.toString());
  throw new Error('provider returned no gas price data');
}

// --- L2 request builders (ETH direct) ---
export function buildDirectRequestStruct(args: {
  chainId: bigint;
  mintValue: bigint;
  l2GasLimit: bigint;
  gasPerPubdata: bigint;
  refundRecipient: Address;
  l2Contract: Address;
  l2Value: bigint;
}) {
  return {
    chainId: args.chainId,
    l2Contract: args.l2Contract,
    mintValue: args.mintValue,
    l2Value: args.l2Value,
    l2Calldata: '0x',
    l2GasLimit: args.l2GasLimit,
    l2GasPerPubdataByteLimit: args.gasPerPubdata,
    factoryDeps: [] as `0x${string}`[],
    refundRecipient: args.refundRecipient,
  };
}

// --- Two-bridges encoding: ERC20 tuple (token, amount, l2Receiver) ---
export function encodeSecondBridgeErc20Args(
  token: Address,
  amount: bigint,
  l2Receiver: Address,
): `0x${string}` {
  return AbiCoder.defaultAbiCoder().encode(
    ['address', 'uint256', 'address'],
    [token, amount, l2Receiver],
  ) as `0x${string}`;
}

export function pickRoute(token: Address): DepositRoute {
  return isEth(token) ? 'eth' : 'erc20-base';
}

export function pct(n: bigint, p: number): bigint {
  return (n * BigInt(100 + p)) / 100n;
}

export async function pickRouteSmart(
  client: EthersClient,
  bridgehub: Address,
  chainIdL2: bigint,
  token: Address,
): Promise<DepositRoute> {
  if (isEth(token)) return 'eth';

  // Determine if this ERC-20 is the base token for the target L2
  const base = await resolveBaseToken(client, bridgehub, chainIdL2);
  if (eqAddr(token, base)) return 'erc20-base';

  return 'erc20-nonbase';
}
function eqAddr(token: string, base: string): boolean {
  if (!token || !base) return false;
  const normalize = (s: string) => {
    const t = s.trim().toLowerCase();
    return t.startsWith('0x') ? t : `0x${t}`;
  };
  return normalize(token) === normalize(base);
}

// type WithdrawalKey = {
//   chainIdL2: bigint; // your L2 chain id
//   l2BatchNumber: bigint; // from proof info / rpc
//   l2MessageIndex: bigint; // from proof info / rpc
// };

// export async function isWithdrawalFinalized(
//   l1Provider: JsonRpcProvider,
//   l1AssetRouter: string,
//   key: WithdrawalKey,
// ): Promise<boolean> {
//   const router = new Contract(l1AssetRouter, IL1AssetRouterAbi, l1Provider);
//   return await router.isWithdrawalFinalized(key.chainIdL2, key.l2BatchNumber, key.l2MessageIndex);
// }

// helpers.ts
// helpers.ts
// export async function fetchWithdrawalProof(l2: any) {
//   try {
//     console.log("Fetching withdrawal proof...");

//     const txHash =
//       "0x930528d058f6242d2dee70fdbee162e1d00e16dc28c2ad280a3485e20a17c85a";
//     const logIndex = 0;

//     const proof = await l2.send("zks_getL2ToL1LogProof", [txHash, logIndex]);
//     console.log("PROOF", proof);

//     if (!proof) throw new Error("empty proof");

//     // Fallback: try to fetch the message directly if not in proof
//     let message: string | undefined = proof.l1Message;
//     if (!message) {
//       const logInfo = await l2.send("zks_getL2ToL1Log", [txHash, logIndex]);
//       message = logInfo?.message;
//     }
//     if (!message) throw new Error("missing withdrawal L1 message bytes");

//     return {
//       l2BatchNumber: BigInt(proof.batch_number ?? proof.batchNumber),
//       l2MessageIndex: BigInt(proof.id ?? proof.index ?? 0),
//       l2TxNumberInBatch: Number(proof.txNumberInBatch ?? 0),
//       merkleProof: proof.proof as string[],
//       message,
//       // Always L1 Messenger (0x...8008) for withdrawals
//       l2Sender: "0x0000000000000000000000000000000000008008",
//     };
//   } catch (e: any) {
//     throw new Error(
//       `Unable to fetch L2->L1 proof: ${String((e as Error)?.message || e)}`
//     );
//   }
// }

// // Structured params expected by L1Nullifier.finalizeDeposit
// export interface FinalizeDepositParams {
//   chainId: bigint;
//   l2BatchNumber: bigint;
//   l2MessageIndex: bigint;
//   l2Sender: Address;
//   l2TxNumberInBatch: number;
//   message: Hex;
//   merkleProof: Hex[];
// }

// export async function fetchFinalizeDepositParams(
//   client: { l1: any; l2: any; chainIdL2?: bigint },
//   l2TxHash: Hex,
// ): Promise<{ params: FinalizeDepositParams; l1AssetRouter: Address; nullifier: Address }> {
//   // 1) Fetch L2 receipt (with l2ToL1Logs)
//   const l2Rcpt = await client.l2.getTransactionReceipt(l2TxHash);
//   if (!l2Rcpt) throw new Error('No L2 receipt found');
//   const raw = await client.l2.send('eth_getTransactionReceipt', [l2TxHash]);
//   (l2Rcpt as any).l2ToL1Logs = raw?.l2ToL1Logs ?? [];

//   // 2) Resolve L1 addresses via L2 bridgehub → L2 assetRouter → L1 assetRouter → L1 nullifier
//   const { l1AssetRouter, nullifierAdd } = await getNullifierAddress({
//     l1: client.l1,
//     l2: client.l2,
//     l2Bridgehub: '0x133303087fc98a0371c422a1e89abd66d8763e73', // canonical L2 bridgehub
//   });

//   console.log('addresses', { l1AssetRouter, nullifierAdd });
//   // 3) Find the correct L2→L1 log (messenger log)
//   const messengerAddr = '0x0000000000000000000000000000000000008008'.toLowerCase();
//   const logs = (l2Rcpt.l2ToL1Logs ?? []) as any[];
//   const idx = logs.findIndex((log) => (log.sender ?? '').toLowerCase() === messengerAddr);
//   if (idx === -1) throw new Error('No messenger log found');
//   const chosenLog = logs[idx];

//   // 4) Fetch proof for that log index
//   const proof = await client.l2.send('zks_getL2ToL1LogProof', [l2TxHash, idx]);
//   if (!proof) throw new Error('No proof returned');
//   console.log('PROOF', proof);
//   // 5) Construct finalizeDeposit params
//   const params: FinalizeDepositParams = {
//     chainId: client.chainIdL2 ?? (await client.l2.getNetwork()).chainId,
//     l2BatchNumber: BigInt(proof.batch_number ?? proof.batchNumber),
//     l2MessageIndex: BigInt(proof.id ?? proof.index ?? 0),
//     l2Sender: chosenLog.sender as Address,
//     l2TxNumberInBatch: chosenLog.tx_number_in_block ?? 0,
//     message: chosenLog.value as Hex,
//     merkleProof: proof.proof as Hex[],
//   };

//   return { params, l1AssetRouter, nullifier: nullifierAdd };
// }

// // import { Contract } from "ethers";
// // import type { Address } from "../../types";
// // import { IBridgehubL2Abi, IL2AssetRouterAbi, IL1AssetRouterAbi } from "../internal/abis";

// /**
//  * Resolve Nullifier by walking:
//  * L2 Bridgehub -> assetRouter() -> L2AssetRouter -> l1Bridge() -> L1AssetRouter -> L1_NULLIFIER()
//  */
// export async function getNullifierAddress(opts: {
//   l1: any; // L1 JsonRpcProvider
//   l2: any; // L2 JsonRpcProvider
//   l2Bridgehub: Address; // **L2** Bridgehub address (must expose assetRouter() on L2)
// }) {
//   const { l1, l2, l2Bridgehub } = opts;

//   // 1) L2 Bridgehub -> L2 Asset Router
//   const bhL2 = new Contract(l2Bridgehub, IBridgehubAbi, l1);
//   const l1AssetRouter = await bhL2.sharedBridge();
//   console.log('L2 ASSET ROUTER', l1AssetRouter);
//   // 2) L2 Asset Router -> L1 Asset Router
//   //const arL2 = new Contract(l2AssetRouter, L2AssetRouterAbi, l2);
//   //const l1AssetRouter = (await arL2.l1Bridge()) as Address;

//   // 3) Sanity: make sure L1 Asset Router is real on your L1 provider
//   // await requireCode(l1, l1AssetRouter, "L1 AssetRouter");

//   // 4) L1 Asset Router -> L1 Nullifier (immutable/public)
//   const arL1 = new Contract(l1AssetRouter, IL1AssetRouterAbi, l1);
//   const nullifier = (await arL1.L1_NULLIFIER()) as Address;
//   console.log('NULLIFIER', nullifier);
//   // 5) Sanity: ensure Nullifier exists on L1
//   //await requireCode(l1, nullifier, "L1 Nullifier");

//   return {
//     l1AssetRouter,
//     nullifier,
//   };
// }
