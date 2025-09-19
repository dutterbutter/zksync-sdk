import { Interface } from 'ethers';
import IERC20ABI from '../../../../core/internal/abis/IERC20.json';
import IBridgehubABI from '../../../../core/internal/abis/IBridgehub.json';

export const IERC20 = new Interface(IERC20ABI as any);
export const IBridgehub = new Interface(IBridgehubABI as any);

// TODO: refactor with other shared fixtures
export const ADDR = {
  bridgehub: '0xb000000000000000000000000000000000000000',
  assetRouter: '0xa000000000000000000000000000000000000000',
  token: '0xc000000000000000000000000000000000000000',
  sender: '0x1111111111111111111111111111111111111111',
  l2Contract: '0x2222222222222222222222222222222222222222',
} as const;

export type CallTx = { to?: string; data?: string };
export const lower = (s?: string) => (s ?? '').toLowerCase();
const selector = (data?: string) => (data ?? '').slice(0, 10).toLowerCase();
const keyOf = (tx: CallTx) => `${lower(tx.to)}|${selector(tx.data)}`;

export const keyFor = (to: string, iface: Interface, fn: string) =>
  `${lower(to)}|${iface.getFunction(fn)!.selector.toLowerCase()}`;

export const enc = (iface: Interface, fn: string, args: unknown[]) =>
  iface.encodeFunctionResult(fn as any, args);

type L1Opts = {
  estimateGas?: bigint | Error;
  getTransactionReceipt?: any; // null | receipt | throws
  waitForTransaction?: any; // null | receipt | throws
  getTransactionCount?: number; // initial nonce
};

export function makeL1Provider(mapping: Record<string, string>, opts: L1Opts = {}) {
  const _estimate = opts.estimateGas;
  const _rcpt = opts.getTransactionReceipt;
  const _wait = opts.waitForTransaction;
  const _nonce = opts.getTransactionCount ?? 0;

  return {
    async call(tx: CallTx) {
      const out = mapping[keyOf(tx)];
      if (!out) throw new Error(`no mapping for ${keyOf(tx)}`);
      return out;
    },
    async estimateGas(_tx: any) {
      if (_estimate instanceof Error) throw _estimate;
      if (typeof _estimate === 'bigint') return _estimate;
      return 100_000n;
    },
    async getTransactionReceipt(_hash: string) {
      if (_rcpt instanceof Error) throw _rcpt;
      return _rcpt ?? null;
    },
    async waitForTransaction(_hash: string) {
      if (_wait instanceof Error) throw _wait;
      return _wait ?? null;
    },
    async getTransactionCount(_addr: string, _blockTag: string) {
      return _nonce;
    },
    async getFeeData() {
      return { gasPrice: 10n };
    },
  } as any;
}

export function makeL2Provider(
  opts: { getTransactionReceipt?: any; waitForTransaction?: any } = {},
) {
  return {
    async getTransactionReceipt(_hash: string) {
      const v = opts.getTransactionReceipt;
      if (v instanceof Error) throw v;
      return v ?? null;
    },
    async waitForTransaction(_hash: string) {
      const v = opts.waitForTransaction;
      if (v instanceof Error) throw v;
      return v ?? null;
    },
    async getNetwork() {
      return { chainId: 324n };
    },
  } as any;
}

export function makeSigner(l1: any, addr = ADDR.sender) {
  return {
    provider: l1,
    connect(p: any) {
      return { ...this, provider: p };
    },
    async getAddress() {
      return addr;
    },
    async populateTransaction(tx: any) {
      return { ...tx };
    },
    async sendTransaction(tx: any) {
      return {
        hash: ('0x' + 'ab'.repeat(32)) as `0x${string}`,
        async wait() {
          return { status: 1, hash: this.hash };
        },
      };
    },
  } as any;
}

// Build a **minimal** EthersClient mock for DepositsResource
export function makeClient({
  l1,
  l2,
  signer,
  ensure = {
    bridgehub: ADDR.bridgehub,
    l1AssetRouter: ADDR.assetRouter,
    l1Nullifier: '0xd000000000000000000000000000000000000000',
    l1NativeTokenVault: '0xe000000000000000000000000000000000000000',
    l2AssetRouter: '0xf000000000000000000000000000000000000000',
    l2NativeTokenVault: '0xf100000000000000000000000000000000000000',
    l2BaseTokenSystem: '0xf200000000000000000000000000000000000000',
  },
  baseToken = async (_chainId: bigint) => ADDR.token as `0x${string}`,
}: any) {
  return {
    kind: 'ethers',
    l1,
    l2,
    signer,
    zks: { getBridgehubAddress: async () => ADDR.bridgehub },
    ensureAddresses: async () => ensure,
    contracts: async () => ({}) as any,
    refresh: () => {},
    baseToken,
  } as any;
}

// ---------- Common ctx builder ----------
export function makeCtx(l1: any, signer: any, extras?: Partial<any>) {
  return {
    client: { l1, signer },
    sender: ADDR.sender,
    chainIdL2: 324n,
    bridgehub: ADDR.bridgehub,
    l1AssetRouter: ADDR.assetRouter,
    l2GasLimit: 600_000n,
    gasPerPubdata: 800n,
    refundRecipient: ADDR.sender,
    operatorTip: 7n,
    fee: { maxFeePerGas: 1n, maxPriorityFeePerGas: 1n, gasPriceForBaseCost: 5n },
    ...(extras ?? {}),
  };
}
