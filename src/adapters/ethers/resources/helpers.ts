    // src/adapters/ethers/resources/helpers.ts
    import { Contract, AbiCoder, type TransactionRequest } from 'ethers';
    import type { EthersClient } from '../client';
    import type { Address, UInt } from '../../../types/primitives';
    import { IBridgehubAbi } from '../internal/abis/Bridgehub.ts';
    import { ETH_ADDRESS, ETH_ADDRESS_IN_CONTRACTS } from '../../../types/primitives';
    import type { DepositRoute } from '../../../types/deposits';

    // --- Token utils ---
    export function isEth(token: Address): boolean {
    const t = token.toLowerCase();
    return t === ETH_ADDRESS || t === ETH_ADDRESS_IN_CONTRACTS;
    }

    // --- Bridgehub getters ---
    export async function resolveBaseToken(
    client: EthersClient,
    bridgehub: Address,
    chainId: UInt,
    ): Promise<Address> {
    const bh = new Contract(bridgehub, IBridgehubAbi, client.l1);
    return (await bh.baseToken(chainId)) as Address;
    }

    export async function resolveAssetRouter(
    client: EthersClient,
    bridgehub: Address,
    ): Promise<Address> {
    const bh = new Contract(bridgehub, IBridgehubAbi, client.l1);
    return (await bh.assetRouter()) as Address; // no chainId arg in your ABI
    }

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
  token: Address
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

