/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// src/adapters/ethers/resources/deposits.ts
import type { EthersClient } from '../client';
import type {
  DepositParams,
  DepositQuote,
  DepositHandle,
  DepositWaitable,
} from '../../../types/deposits';
import {
    getGasPriceWei,
    isEth,
    resolveBaseToken,
    resolveAssetRouter,
    buildDirectRequestStruct,
    getFeeOverrides,
    encodeSecondBridgeErc20Args
} from './helpers';
import { Address, Hex } from '../../../types/primitives';
import type { TransactionRequest, TransactionReceipt } from 'ethers';

import { Contract } from 'ethers';
import { IBridgehubAbi } from '../internal/abis/Bridgehub.ts';

// 🚨 NEW: minimal ERC20 ABI fragment (approve, allowance)
const IERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
] as const;



// --------------------
// Public interface
// --------------------
export interface DepositsResource {
  quote(p: DepositParams): Promise<DepositQuote>;
  tryQuote(p: DepositParams): Promise<{ ok: true; value: DepositQuote } | { ok: false; error: unknown }>;

  prepare(p: DepositParams): Promise<TransactionRequest[]>;
  tryPrepare(p: DepositParams): Promise<{ ok: true; value: TransactionRequest[] } | { ok: false; error: unknown }>;

  create(p: DepositParams): Promise<DepositHandle>;
  tryCreate(p: DepositParams): Promise<{ ok: true; value: DepositHandle } | { ok: false; error: unknown }>;

  wait(h: DepositWaitable, opts: { for: 'l1' | 'l2' | 'finalized' }): Promise<TransactionReceipt | null>;
}

// --------------------
// Helpers (ethers-only, no custom ABI)
// --------------------
// TODO: move gas related helpers to centralized file
// async function getGasPriceWei(client: EthersClient): Promise<bigint> {
//   // prefer FeeData.gasPrice if available; fallback to FeeData.maxFeePerGas
//   const fd = await client.l1.getFeeData();
//   if (fd.gasPrice != null) return BigInt(fd.gasPrice.toString());
//   if (fd.maxFeePerGas != null) return BigInt(fd.maxFeePerGas.toString());
//   throw new Error('provider returned no gas price data');
// }

// // 🚨 NEW: ETH sentinel check
// function isEth(token: Address): boolean {
//   const t = token.toLowerCase();
//   return t === ETH_ADDRESS || t === ETH_ADDRESS_IN_CONTRACTS;
// }

// // 🚨 NEW: read base token of target L2 from Bridgehub
// async function resolveBaseToken(client: EthersClient, bridgehub: Address, chainId: bigint): Promise<Address> {
//   const bh = new Contract(bridgehub, IBridgehubAbi, client.l1);
//   // Adjust selector if your Bridgehub exposes a different getter
//   // e.g. `function baseToken(uint256) view returns (address)`
//   const baseToken: string = await bh.baseToken(chainId);
//   return baseToken as Address;
// }

// // 🚨 NEW: resolve the L1 ERC20 router/bridge address via Bridgehub
// async function resolveL1Erc20Router(client: EthersClient, bridgehub: Address, chainId: bigint): Promise<Address> {
//   const bh = new Contract(bridgehub, IBridgehubAbi, client.l1);
//   // Choose ONE appropriate getter your Bridgehub provides:
//   //  - assetRouter(chainId) -> address
//   //  - sharedBridge(chainId) -> address
//   // For now we try `assetRouter(uint256)`; change if your deployment differs.
//   const router: string = await bh.assetRouter();
//   return router as Address;
// }

// /**
//  * Minimal L2 tx payload for ETH path: we only fund the L2 ticket (no custom L2 call yet).
//  * If you want to finalize into the L2 AssetRouter right away, we can wire its calldata here later.
//  */
// function buildDirectRequestStruct(args: {
//   chainId: bigint;
//   mintValue: bigint;
//   l2GasLimit: bigint;
//   gasPerPubdata: bigint;
//   refundRecipient: Address;
//   l2Contract: Address;
//   l2Value: bigint;
// }) {
//   return {
//     chainId: args.chainId,
//     l2Contract: args.l2Contract,
//     mintValue: args.mintValue,
//     l2Value: args.l2Value,
//     l2Calldata: '0x',
//     l2GasLimit: args.l2GasLimit,
//     l2GasPerPubdataByteLimit: args.gasPerPubdata,
//     factoryDeps: [] as `0x${string}`[],
//     refundRecipient: args.refundRecipient,
//   };
// }

// --------------------
// Resource factory
// --------------------
export function DepositsResource(client: EthersClient): DepositsResource {
  return {
    async quote(p) {
      // Resolve Bridgehub + target chain id from the connected L2 (no registry required)
      const { bridgehub } = await client.ensureAddresses();
      const { chainId } = await client.l2.getNetwork();

      // Gas guidance (safe defaults; adapter can refine later)
      const l2GasLimit = p.l2GasLimit ?? 300_000n;
      const gasPerPubdata = p.gasPerPubdata ?? 800n;

      // Compute baseCost via Bridgehub.l2TransactionBaseCost(chainId, gasPrice, l2GasLimit, gasPerPubdata)
      const gasPrice = await getGasPriceWei(client);
      const bh = new Contract(bridgehub, IBridgehubAbi, client.l1) as unknown as Contract;

      // TODO: make typesafe / appease linter
      // Call the contract and normalize to bigint
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const baseCost = await bh.l2TransactionBaseCost(
        BigInt(chainId),             // uint256 _chainId (target L2)
        gasPrice,            // uint256 _gasPrice (L1 gas price)
        l2GasLimit,          // uint256 _l2GasLimit
        gasPerPubdata        // uint256 _l2GasPerPubdataByteLimit
      );

      const baseToken = await resolveBaseToken(client, bridgehub, chainId);
      const route = isEth(p.token)
        ? 'eth'
        : 'erc20-base'; // for ETH-based L2s we consider ERC20 deposit as "erc20-base" (base token = ETH)
      
      // Approvals (only for ERC20 route)
      const approvalsNeeded: { token: Address; spender: Address; amount: bigint }[] = [];
      if (route !== 'eth') {
        const router = await resolveAssetRouter(client, bridgehub);
        const erc20 = new Contract(p.token, IERC20_ABI, client.l1);
        const owner = await client.signer.getAddress();
        const allowance: bigint = await erc20.allowance(owner, router);
        if (allowance < p.amount) {
          approvalsNeeded.push({ token: p.token, spender: router, amount: p.amount });
        }
      }

    const q: DepositQuote = {
        route: route as any,
        approvalsNeeded,
        baseCost: BigInt(baseCost),
        suggestedL2GasLimit: l2GasLimit,
        gasPerPubdata,
        minGasLimitApplied: true,
        gasBufferPctApplied: 10,
      };
      return q;
    },

    async tryQuote(p) {
      try {
        return { ok: true, value: await this.quote(p) };
      } catch (err) {
        return { ok: false, error: err };
      }
    },

    async prepare(p) {
      const { bridgehub } = await client.ensureAddresses();
      const { chainId } = await client.l2.getNetwork();

      // 1) Recompute baseCost for consistency (or accept a passed-in hint later)
      const l2GasLimit = p.l2GasLimit ?? 300_000n;
      const gasPerPubdata = p.gasPerPubdata ?? 800n;
    
      // TODO: fix this
      const bh = new Contract(bridgehub, IBridgehubAbi, client.l1);

      const fee = await getFeeOverrides(client);
    //   const fee = await client.l1.getFeeData();
    //   const use1559 = fee.maxFeePerGas != null && fee.maxPriorityFeePerGas != null;
    //   const feeOverrides: Partial<TransactionRequest> = use1559
    //       ? { maxFeePerGas: fee.maxFeePerGas, maxPriorityFeePerGas: fee.maxPriorityFeePerGas }
    //       : { gasPrice: fee.gasPrice! };

      // Derive the gas price number used for baseCost (must match the tx)
      // Prefer fee.gasPrice when present, otherwise fall back to maxFeePerGas.
    //   const gpBn = fee.gasPrice ?? fee.maxFeePerGas;
    //   if (gpBn == null) throw new Error('provider returned no gas price data');
    //   const gasPriceForBaseCost = BigInt(gpBn.toString());

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const baseCost = await bh.l2TransactionBaseCost(BigInt(chainId), fee.gasPriceForBaseCost, l2GasLimit, gasPerPubdata);
      
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const operatorTip = p.operatorTip ?? 0n;
      
      // 2) Build struct for requestL2TransactionDirect (single arg, strict shape)
      const sender = (await client.signer.getAddress()) as Address;
      const refundRecipient = p.refundRecipient ?? sender;
    //   const l2Contract = p.to ?? sender;
    //   const l2Value = p.amount;

            // Route detection
      const baseToken = await resolveBaseToken(client, bridgehub, chainId);
      const isEthRoute = isEth(p.token);
      const txs: TransactionRequest[] = [];

     if (isEthRoute) {
        // ------ ETH route (same as you have today) ------
        const l2Contract = p.to ?? sender;
        const l2Value = p.amount;
        const mintValue = baseCost + operatorTip + p.amount; // pay baseCost + tip + l2Value

        const req = buildDirectRequestStruct({
          chainId: chainId,
          mintValue,
          l2GasLimit,
          gasPerPubdata,
          refundRecipient,
          l2Contract,
          l2Value,
        });

        const bhWithSigner = bh.connect(client.signer);
        const data = bhWithSigner.interface.encodeFunctionData('requestL2TransactionDirect', [req]);
        const tx: TransactionRequest = {
          to: bridgehub,
          data,
          value: mintValue,
          from: sender,
          ...fee,
        };
        // optional buffer
        try { const est = await client.l1.estimateGas(tx); tx.gasLimit = (BigInt(est) * 115n) / 100n; } catch {
            // ignore
        }
        txs.push(tx);
      } else {
        // ------ ERC20 route (ETH-based L2) ------
        // 1) Resolve router
        const router = await resolveAssetRouter(client, bridgehub);
        const erc20 = new Contract(p.token, IERC20_ABI, client.signer);

        // 2) Allowance check (prepare approve if needed)
        const allowance: bigint = await erc20.allowance(sender, router);
        const needsApprove = allowance < p.amount;

        if (needsApprove) {
        const approveData = erc20.interface.encodeFunctionData('approve', [router, p.amount]);
        txs.push({
            to: p.token,
            data: approveData,
            from: sender,
            // keep fee overrides; DO NOT set nonce here
            ...fee,
        });
        }
        const secondBridgeCalldata = encodeSecondBridgeErc20Args(p.token, p.amount, p.to ?? sender);

        // const secondBridgeCalldata = AbiCoder.defaultAbiCoder().encode(
        //     ['address', 'uint256', 'address'],
        //     [p.token, p.amount, p.to ?? sender]
        // );


        const mintValue = baseCost + operatorTip;
        const outer = {
        chainId: BigInt(chainId),        // uint256
        mintValue,                        // uint256
        l2Value: 0n,                      // uint256
        l2GasLimit,                       // uint256
        l2GasPerPubdataByteLimit: gasPerPubdata, // uint256
        refundRecipient,                  // address
        secondBridgeAddress: router,      // address (L1AssetRouter)
        secondBridgeValue: 0n,            // uint256 (no ETH sent to router for ERC20)
        secondBridgeCalldata,             // bytes
        } as const;

        // Encode the Bridgehub call
        const dataTwo = bh.interface.encodeFunctionData('requestL2TransactionTwoBridges', [outer]);

        const tx: TransactionRequest = {
        to: bridgehub,
        data: dataTwo,
        value: mintValue, // must equal mintValue + secondBridgeValue (here just mintValue)
        from: sender,
        ...fee,
        };
        if (!needsApprove) {
        try {
            const est = await client.l1.estimateGas(tx);
            tx.gasLimit = (BigInt(est) * 115n) / 100n;
        } catch {
            // ignore; provider will fill at send time
        }
        }
        txs.push(tx);
      }

      return txs;
    },

    async tryPrepare(p) {
      try {
        return { ok: true, value: await this.prepare(p) };
      } catch (err) {
        return { ok: false, error: err };
      }
    },

    async create(p) {
      const txs = await this.prepare(p);
      let lastHash: Hex | undefined;
      for (const tx of txs) {
        const sent = await client.signer.sendTransaction(tx);
        lastHash = sent.hash as Hex;
        await sent.wait();
      }
      return { kind: 'deposit', l1TxHash: lastHash! };
    },
    async tryCreate(p) {
      try {
        return { ok: true, value: await this.create(p) };
      } catch (err) {
        return { ok: false, error: err };
      }
    },

    // TODO: still need wire up finalization flow
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async wait(h, _opts) {
      // Normalize the input to an L1 hash
      const hash = typeof h === 'string' ? h : h.l1TxHash;
      return await client.l1.waitForTransaction(hash);
    },
  };
}
