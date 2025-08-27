/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// src/adapters/ethers/resources/deposits.ts
import type { EthersClient } from '../client';
import type {
  DepositParams,
  DepositQuote,
  DepositHandle,
  DepositWaitable,
  DepositPlan,
  PlanStep,
} from '../../../types/deposits';
import {
  isEth,
  // resolveBaseToken,
  resolveAssetRouter,
  buildDirectRequestStruct,
  getFeeOverrides,
  encodeSecondBridgeErc20Args,
  pct,
} from './helpers';
import type { Address, Hex } from '../../../types/primitives';
import type { TransactionRequest } from 'ethers';

import { Contract } from 'ethers';
import { IBridgehubAbi } from '../internal/abis/Bridgehub.ts';
import { ERC20Abi } from '../internal/abis/ERC20.ts';

// --------------------
// Public interface
// --------------------
export interface DepositsResource {
  quote(p: DepositParams): Promise<DepositQuote>;
  tryQuote(
    p: DepositParams,
  ): Promise<{ ok: true; value: DepositQuote } | { ok: false; error: unknown }>;

  prepare(p: DepositParams): Promise<DepositPlan>;
  tryPrepare(
    p: DepositParams,
  ): Promise<{ ok: true; value: DepositPlan } | { ok: false; error: unknown }>;

  create(p: DepositParams): Promise<DepositHandle>;
  tryCreate(
    p: DepositParams,
  ): Promise<{ ok: true; value: DepositHandle } | { ok: false; error: unknown }>;

  wait(
    h: DepositWaitable,
    opts: { for: 'l1' | 'l2' | 'finalized' },
  ): Promise<import('ethers').TransactionReceipt | null>;
}

// --------------------
// Resource factory
// --------------------
export function DepositsResource(client: EthersClient): DepositsResource {
  async function buildPlan(p: DepositParams): Promise<DepositPlan> {
    const { bridgehub } = await client.ensureAddresses();
    const { chainId } = await client.l2.getNetwork();
    const route = isEth(p.token) ? 'eth' : 'erc20-base';

    const l2GasLimit = p.l2GasLimit ?? 300_000n;
    const gasPerPubdata = p.gasPerPubdata ?? 800n;
    const operatorTip = p.operatorTip ?? 0n;
    const sender = (await client.signer.getAddress()) as Address;
    const refundRecipient = p.refundRecipient ?? sender;

    const bh = new Contract(bridgehub, IBridgehubAbi, client.l1);
    const fee = await getFeeOverrides(client);

    const { baseCost } = await (async () => {
      const gp = fee.gasPriceForBaseCost; // stable for baseCost calc
      const c: bigint = await bh.l2TransactionBaseCost(
        BigInt(chainId),
        gp,
        l2GasLimit,
        gasPerPubdata,
      );
      return { baseCost: BigInt(c) };
    })();

    const approvalsNeeded: { token: Address; spender: Address; amount: bigint }[] = [];
    const steps: PlanStep[] = [];

    if (route === 'eth') {
      const l2Contract = p.to ?? sender;
      const l2Value = p.amount;
      const mintValue = baseCost + operatorTip + l2Value;

      const req = buildDirectRequestStruct({
        chainId: BigInt(chainId),
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

      try {
        const est = await client.l1.estimateGas(tx);
        tx.gasLimit = pct(est, 15);
      } catch {
        // ignore gas estimation errors
      }

      steps.push({
        key: 'bridgehub:direct',
        kind: 'bridgehub:direct',
        description: 'Bridge ETH via Bridgehub.requestL2TransactionDirect',
        canSkip: false,
        tx,
      });

      return {
        route,
        summary: {
          route,
          approvalsNeeded,
          baseCost,
          mintValue,
          suggestedL2GasLimit: l2GasLimit,
          gasPerPubdata,
          minGasLimitApplied: true,
          gasBufferPctApplied: 10,
        },
        steps,
      };
    }

    // ERC20 on ETH-based L2 (two-bridges)
    const router = await resolveAssetRouter(client, bridgehub);
    const erc20 = new Contract(p.token, ERC20Abi, client.signer);
    const allowance: bigint = await erc20.allowance(sender, router);
    const needsApprove = allowance < p.amount;

    if (needsApprove) {
      approvalsNeeded.push({ token: p.token, spender: router, amount: p.amount });
      const approveData = erc20.interface.encodeFunctionData('approve', [router, p.amount]);
      const approveTx: TransactionRequest = {
        to: p.token,
        data: approveData,
        from: sender,
        ...fee,
      };
      steps.push({
        key: `approve:${p.token}:${router}`,
        kind: 'approve',
        description: `Approve ${p.amount} for router`,
        canSkip: false,
        tx: approveTx,
      });
    }

    const secondBridgeCalldata = encodeSecondBridgeErc20Args(p.token, p.amount, p.to ?? sender);
    const mintValue = baseCost + operatorTip;

    const outer = {
      chainId: BigInt(chainId),
      mintValue,
      l2Value: 0n,
      l2GasLimit,
      l2GasPerPubdataByteLimit: gasPerPubdata,
      refundRecipient,
      secondBridgeAddress: router,
      secondBridgeValue: 0n,
      secondBridgeCalldata,
    } as const;

    const dataTwo = bh.interface.encodeFunctionData('requestL2TransactionTwoBridges', [outer]);
    const bridgeTx: TransactionRequest = {
      to: bridgehub,
      data: dataTwo,
      value: mintValue,
      from: sender,
      ...fee,
    };
    try {
      const est = await client.l1.estimateGas(bridgeTx);
      bridgeTx.gasLimit = pct(est, 15);
    } catch {
      //
    }

    steps.push({
      key: 'bridgehub:two-bridges',
      kind: 'bridgehub:two-bridges',
      description: 'Bridge ERC20 via Bridgehub.requestL2TransactionTwoBridges',
      canSkip: false,
      tx: bridgeTx,
    });

    return {
      route,
      summary: {
        route,
        approvalsNeeded,
        baseCost,
        mintValue,
        suggestedL2GasLimit: l2GasLimit,
        gasPerPubdata,
        minGasLimitApplied: true,
        gasBufferPctApplied: 10,
      },
      steps,
    };
  }
  return {
    async quote(p) {
      const plan = await buildPlan(p);
      return plan.summary;
    },

    async tryQuote(p) {
      try {
        return { ok: true, value: await this.quote(p) };
      } catch (err) {
        return { ok: false, error: err };
      }
    },

    async prepare(p) {
      return await buildPlan(p);
    },

    async tryPrepare(p) {
      try {
        return { ok: true, value: await this.prepare(p) };
      } catch (err) {
        return { ok: false, error: err };
      }
    },

    async create(p) {
      const plan = await this.prepare(p);
      const stepHashes: Record<string, Hex> = {};

      const from = await client.signer.getAddress();
      let next = await client.l1.getTransactionCount(from, 'pending'); // include pending

      for (const step of plan.steps) {
        // re-check allowance so we only send real steps
        if (step.kind === 'approve') {
          const [, token, router] = step.key.split(':');
          const erc20 = new Contract(token as Address, ERC20Abi, client.signer);
          const target = plan.summary.approvalsNeeded[0]?.amount ?? 0n;
          if ((await erc20.allowance(from, router as Address)) >= target) continue;
        }
        step.tx.nonce = next++;

        if (!step.tx.gasLimit) {
          try {
            const est = await client.l1.estimateGas(step.tx);
            step.tx.gasLimit = (BigInt(est) * 115n) / 100n;
          } catch {
            // ignore
          }
        }

        const sent = await client.signer.sendTransaction(step.tx);
        stepHashes[step.key] = sent.hash as Hex;
        await sent.wait();
      }

      const keys = Object.keys(stepHashes);
      return { kind: 'deposit', l1TxHash: stepHashes[keys[keys.length - 1]], stepHashes, plan };
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
