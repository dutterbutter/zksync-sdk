import { useCallback, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import {
  BrowserProvider,
  JsonRpcProvider,
  type JsonRpcSigner,
  type TransactionReceipt,
  formatEther,
  parseEther,
} from 'ethers';

import {
  createEthersClient,
  createEthersSdk,
  type EthersSdk,
} from '@dutterbutter/zksync-sdk/ethers';
import type {
  WithdrawHandle,
  WithdrawPlan,
  WithdrawQuote,
  WithdrawalStatus,
} from '@dutterbutter/zksync-sdk/core';
import type { Address, Hex } from '../../../../src/core/types/primitives';
import { ETH_ADDRESS } from '@dutterbutter/zksync-sdk/core';

declare global {
  interface Window {
    ethereum?: unknown;
  }
}

type Action =
  | 'connect'
  | 'quote'
  | 'prepare'
  | 'create'
  | 'status'
  | 'waitL2'
  | 'waitReady'
  | 'waitFinalized'
  | 'finalize';

const DEFAULT_L1_RPC = 'https://ethereum-sepolia-rpc.publicnode.com';
const DEFAULT_L2_RPC = 'https://zksync-os-testnet-alpha.zksync.dev/';
const DEFAULT_L2_GAS_LIMIT = 300_000n;
const DEFAULT_L1_CHAIN_ID = 11155111;

const stringify = (value: unknown) =>
  JSON.stringify(
    value,
    (_, v) => {
      if (typeof v === 'bigint') return v.toString();
      return v;
    },
    2,
  );

const describeAmount = (wei: bigint) => `${formatEther(wei)} ETH`;

const parseOptionalBigInt = (value: string, label: string) => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    return BigInt(trimmed);
  } catch {
    throw new Error(`${label} must be a whole number (wei).`);
  }
};

interface ResultCardProps {
  title: string;
  data: unknown | null | undefined;
}

function ResultCard({ title, data }: ResultCardProps) {
  if (data == null) return null;
  return (
    <section className="result-card">
      <h3>{title}</h3>
      <pre>
        <code>{stringify(data)}</code>
      </pre>
    </section>
  );
}

function Example() {
  const [account, setAccount] = useState<Address>();
  const [walletChainId, setWalletChainId] = useState<number>();
  const [connectedL2ChainId, setConnectedL2ChainId] = useState<number>();
  const [sdk, setSdk] = useState<EthersSdk>();
  const [l1Provider, setL1Provider] = useState<JsonRpcProvider | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [connectedL2Rpc, setConnectedL2Rpc] = useState(DEFAULT_L2_RPC);

  const [quote, setQuote] = useState<WithdrawQuote>();
  const [plan, setPlan] = useState<WithdrawPlan<unknown>>();
  const [handle, setHandle] = useState<WithdrawHandle<unknown>>();
  const [status, setStatus] = useState<WithdrawalStatus>();
  const [waitL2Result, setWaitL2Result] = useState<unknown>();
  const [waitReadyResult, setWaitReadyResult] = useState<unknown>();
  const [waitFinalizedResult, setWaitFinalizedResult] = useState<TransactionReceipt | null>();
  const [finalizeResult, setFinalizeResult] = useState<
    { status: WithdrawalStatus; receipt?: TransactionReceipt } | undefined
  >();

  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<Action | null>(null);

  const [l2Rpc, setL2Rpc] = useState(DEFAULT_L2_RPC);
  const [amount, setAmount] = useState('0.01');
  const [token, setToken] = useState(ETH_ADDRESS);
  const [recipient, setRecipient] = useState('');
  const [l2GasLimitInput, setL2GasLimitInput] = useState(DEFAULT_L2_GAS_LIMIT.toString());
  const [l2MaxFeeInput, setL2MaxFeeInput] = useState('');
  const [l2PriorityFeeInput, setL2PriorityFeeInput] = useState('');
  const [l2TxInput, setL2TxInput] = useState('');

  const targetL2Rpc = useMemo(() => l2Rpc.trim() || DEFAULT_L2_RPC, [l2Rpc]);

  const amountLabel = useMemo(() => {
    const trimmed = amount.trim();
    if (!trimmed) return '—';
    try {
      return describeAmount(parseEther(trimmed));
    } catch {
      return '—';
    }
  }, [amount]);

  const walletChainLabel = useMemo(() => {
    if (!walletChainId) return '—';
    if (walletChainId === DEFAULT_L1_CHAIN_ID) return `Sepolia (${walletChainId})`;
    if (walletChainId === 1) return `Mainnet (${walletChainId})`;
    return `${walletChainId}`;
  }, [walletChainId]);

  const l2ChainLabel = useMemo(() => {
    if (!connectedL2ChainId) return '—';
    if (connectedL2ChainId === 324) return `zkSync Era (${connectedL2ChainId})`;
    if (connectedL2ChainId === 300) return `zkSync Sepolia (${connectedL2ChainId})`;
    return `${connectedL2ChainId}`;
  }, [connectedL2ChainId]);

  const run = useCallback(
    async <T,>(action: Action, fn: () => Promise<T>, onSuccess?: (value: T) => void) => {
      setBusy(action);
      setError(undefined);
      try {
        const value = await fn();
        onSuccess?.(value);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const refreshSdkIfNeeded = useCallback(async (): Promise<EthersSdk> => {
    if (!signer || !l1Provider) throw new Error('Connect wallet first.');
    if (sdk && connectedL2Rpc === targetL2Rpc) return sdk;

    const l2Provider = new JsonRpcProvider(targetL2Rpc);
    const client = createEthersClient({ l1: l1Provider, l2: l2Provider, signer });
    const instance = createEthersSdk(client);
    const { chainId } = await l2Provider.getNetwork();

    setSdk(instance);
    setConnectedL2Rpc(targetL2Rpc);
    setConnectedL2ChainId(Number(chainId));
    return instance;
  }, [connectedL2Rpc, l1Provider, sdk, signer, targetL2Rpc]);

  const buildParams = useCallback(() => {
    if (!account) throw new Error('Connect wallet first.');

    const trimmedAmount = amount.trim();
    if (!trimmedAmount) throw new Error('Provide an amount.');

    const parsedAmount = (() => {
      try {
        return parseEther(trimmedAmount);
      } catch {
        throw new Error('Amount must be a valid ETH value (e.g. 0.05).');
      }
    })();

    const tokenAddr = token.trim() || ETH_ADDRESS;
    if (!tokenAddr.startsWith('0x')) {
      throw new Error('Token address must be 0x-prefixed.');
    }

    const toAddress = (recipient.trim() || account) as Address;
    const l2GasLimit = l2GasLimitInput.trim()
      ? parseOptionalBigInt(l2GasLimitInput, 'L2 gas limit')
      : undefined;

    const overrides = {
      maxFeePerGas: l2MaxFeeInput.trim()
        ? parseOptionalBigInt(l2MaxFeeInput, 'Max fee per gas')
        : undefined,
      maxPriorityFeePerGas: l2PriorityFeeInput.trim()
        ? parseOptionalBigInt(l2PriorityFeeInput, 'Max priority fee per gas')
        : undefined,
    };

    const hasOverrides = overrides.maxFeePerGas != null || overrides.maxPriorityFeePerGas != null;

    return {
      amount: parsedAmount,
      token: tokenAddr as Address,
      to: toAddress,
      ...(l2GasLimit != null ? { l2GasLimit } : {}),
      ...(hasOverrides ? { l2TxOverrides: overrides } : {}),
    } as const;
  }, [account, amount, token, recipient, l2GasLimitInput, l2MaxFeeInput, l2PriorityFeeInput]);

  const connectWallet = useCallback(
    () =>
      run(
        'connect',
        async () => {
          if (!window.ethereum) {
            throw new Error('No injected wallet found. Install MetaMask or another wallet.');
          }

          const browserProvider = new BrowserProvider(window.ethereum);
          await browserProvider.send('eth_requestAccounts', []);
          const nextSigner = (await browserProvider.getSigner()) as JsonRpcSigner;
          const addr = (await nextSigner.getAddress()) as Address;
          const walletNetwork = await browserProvider.getNetwork();

          const l1 = new JsonRpcProvider(DEFAULT_L1_RPC);
          const l2 = new JsonRpcProvider(targetL2Rpc);
          const client = createEthersClient({ l1, l2, signer: nextSigner });
          const instance = createEthersSdk(client);
          const { chainId: l2ChainId } = await l2.getNetwork();

          return {
            instance,
            l1Provider: l1,
            signer: nextSigner,
            addr,
            walletChainId: Number(walletNetwork.chainId),
            l2ChainId: Number(l2ChainId),
          };
        },
        ({ instance, l1Provider: l1, signer: nextSigner, addr, walletChainId, l2ChainId }) => {
          setSdk(instance);
          setL1Provider(l1);
          setSigner(nextSigner);
          setAccount(addr);
          setWalletChainId(walletChainId);
          setConnectedL2ChainId(l2ChainId);
          setConnectedL2Rpc(targetL2Rpc);
          setRecipient((prev) => prev || addr);
          setQuote(undefined);
          setPlan(undefined);
          setHandle(undefined);
          setStatus(undefined);
          setWaitL2Result(undefined);
          setWaitReadyResult(undefined);
          setWaitFinalizedResult(undefined);
          setFinalizeResult(undefined);
          setL2TxInput('');
        },
      ),
    [run, targetL2Rpc],
  );

  const hasWaitableInput = handle != null || Boolean(l2TxInput.trim());
  const hasFinalizeHash = Boolean(l2TxInput.trim() || handle?.l2TxHash);

  const actionDisabled = (
    action: Action,
    opts?: { requiresWaitable?: boolean; requiresHash?: boolean },
  ) => {
    if (busy && busy !== action) return true;
    if (!account && action !== 'connect') return true;
    if (opts?.requiresWaitable && !hasWaitableInput) return true;
    if (opts?.requiresHash && !hasFinalizeHash) return true;
    return false;
  };

  const resolveWaitable = useCallback(() => {
    const trimmed = l2TxInput.trim();
    if (trimmed) return trimmed as Hex;
    if (handle) return handle;
    return null;
  }, [handle, l2TxInput]);

  const resolveL2Hash = useCallback(() => {
    const trimmed = l2TxInput.trim();
    if (trimmed) return trimmed as Hex;
    if (handle?.l2TxHash) return handle.l2TxHash as Hex;
    return null;
  }, [handle, l2TxInput]);

  const assertWalletOnL2 = useCallback(async () => {
    if (!signer) throw new Error('Connect wallet first.');
    if (!connectedL2ChainId) {
      throw new Error('Connect wallet again to resolve the target L2 chain.');
    }
    try {
      const network = await signer.provider?.getNetwork();
      if (network && Number(network.chainId) !== connectedL2ChainId) {
        throw new Error(
          `Switch your wallet to chain id ${connectedL2ChainId} before submitting the withdrawal.`,
        );
      }
    } catch {
      throw new Error('Unable to verify wallet chain. Please switch to the target L2.');
    }
  }, [connectedL2ChainId, signer]);

  const assertWalletOnL1 = useCallback(async () => {
    if (!signer) throw new Error('Connect wallet first.');
    try {
      const network = await signer.provider?.getNetwork();
      if (network && Number(network.chainId) !== DEFAULT_L1_CHAIN_ID) {
        throw new Error(
          `Switch your wallet to Sepolia (chain id ${DEFAULT_L1_CHAIN_ID}) before finalizing.`,
        );
      }
    } catch {
      throw new Error('Unable to verify wallet chain. Switch to Sepolia to finalize.');
    }
  }, [signer]);

  const quoteWithdrawal = useCallback(
    () =>
      run(
        'quote',
        async () => {
          const currentSdk = await refreshSdkIfNeeded();
          const params = buildParams();
          const result = await currentSdk.withdrawals.tryQuote(params);
          if (!result.ok) throw result.error;
          return result.value;
        },
        (value) => setQuote(value),
      ),
    [buildParams, refreshSdkIfNeeded, run],
  );

  const prepareWithdrawal = useCallback(
    () =>
      run(
        'prepare',
        async () => {
          const currentSdk = await refreshSdkIfNeeded();
          const params = buildParams();
          const result = await currentSdk.withdrawals.tryPrepare(params);
          if (!result.ok) throw result.error;
          return result.value;
        },
        (value) => setPlan(value),
      ),
    [buildParams, refreshSdkIfNeeded, run],
  );

  const createWithdrawal = useCallback(
    () =>
      run(
        'create',
        async () => {
          await assertWalletOnL2();
          const currentSdk = await refreshSdkIfNeeded();
          const params = buildParams();
          const result = await currentSdk.withdrawals.tryCreate(params);
          if (!result.ok) throw result.error;
          return result.value;
        },
        (value) => {
          setHandle(value);
          setStatus(undefined);
          setWaitL2Result(undefined);
          setWaitReadyResult(undefined);
          setWaitFinalizedResult(undefined);
          setFinalizeResult(undefined);
          setL2TxInput(value.l2TxHash ?? '');
        },
      ),
    [assertWalletOnL2, buildParams, refreshSdkIfNeeded, run],
  );

  const checkStatus = useCallback(
    () =>
      run(
        'status',
        async () => {
          const waitable = resolveWaitable();
          if (!waitable) throw new Error('Provide an L2 transaction hash or create a withdrawal.');
          const currentSdk = await refreshSdkIfNeeded();
          return currentSdk.withdrawals.status(waitable);
        },
        (value) => setStatus(value),
      ),
    [refreshSdkIfNeeded, resolveWaitable, run],
  );

  const waitForL2 = useCallback(
    () =>
      run(
        'waitL2',
        async () => {
          const waitable = resolveWaitable();
          if (!waitable) throw new Error('Provide an L2 transaction hash or create a withdrawal.');
          const currentSdk = await refreshSdkIfNeeded();
          return currentSdk.withdrawals.wait(waitable, { for: 'l2' });
        },
        (value) => setWaitL2Result(value),
      ),
    [refreshSdkIfNeeded, resolveWaitable, run],
  );

  const waitForReady = useCallback(
    () =>
      run(
        'waitReady',
        async () => {
          const waitable = resolveWaitable();
          if (!waitable) throw new Error('Provide an L2 transaction hash or create a withdrawal.');
          const currentSdk = await refreshSdkIfNeeded();
          return currentSdk.withdrawals.wait(waitable, { for: 'ready' });
        },
        (value) => setWaitReadyResult(value ?? { ready: true }),
      ),
    [refreshSdkIfNeeded, resolveWaitable, run],
  );

  const waitForFinalized = useCallback(
    () =>
      run(
        'waitFinalized',
        async () => {
          const waitable = resolveWaitable();
          if (!waitable) throw new Error('Provide an L2 transaction hash or create a withdrawal.');
          const currentSdk = await refreshSdkIfNeeded();
          return currentSdk.withdrawals.wait(waitable, { for: 'finalized' });
        },
        (value) => setWaitFinalizedResult(value ?? null),
      ),
    [refreshSdkIfNeeded, resolveWaitable, run],
  );

  const finalizeWithdrawal = useCallback(
    () =>
      run(
        'finalize',
        async () => {
          const hash = resolveL2Hash();
          if (!hash) throw new Error('Provide an L2 transaction hash or create a withdrawal.');
          await assertWalletOnL1();
          const currentSdk = await refreshSdkIfNeeded();
          const result = await currentSdk.withdrawals.tryFinalize(hash);
          if (!result.ok) throw result.error;
          return result.value;
        },
        (value) => setFinalizeResult(value),
      ),
    [assertWalletOnL1, refreshSdkIfNeeded, resolveL2Hash, run],
  );

  return (
    <main>
      <h1>Ethers Withdrawals (UI example)</h1>

      <section>
        <h2>Wallet</h2>
        <div className="field">
          <label>Account</label>
          <input readOnly value={account ?? ''} placeholder="Not connected" />
        </div>
        <div className="inline-fields">
          <div className="field">
            <label>L1 RPC</label>
            <input readOnly value={DEFAULT_L1_RPC} />
          </div>
          <div className="field">
            <label>Wallet chain</label>
            <input readOnly value={walletChainLabel} />
          </div>
          <div className="field">
            <label>zkSync RPC</label>
            <input
              value={l2Rpc}
              onChange={(event) => setL2Rpc(event.target.value)}
              placeholder={DEFAULT_L2_RPC}
            />
          </div>
          <div className="field">
            <label>zkSync chain</label>
            <input readOnly value={l2ChainLabel} />
          </div>
        </div>
        <button onClick={connectWallet} disabled={actionDisabled('connect')}>
          {busy === 'connect' ? 'Connecting…' : account ? 'Reconnect' : 'Connect Wallet'}
        </button>
      </section>

      <section>
        <h2>Withdrawal parameters</h2>
        <div className="field">
          <label>Amount (ETH)</label>
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            placeholder="0.05"
          />
        </div>
        <div className="field">
          <label>Token address</label>
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder={ETH_ADDRESS}
          />
        </div>
        <div className="field">
          <label>Recipient (defaults to connected account)</label>
          <input
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
            placeholder={account}
          />
        </div>
        <div className="inline-fields">
          <div className="field">
            <label>L2 gas limit</label>
            <input
              value={l2GasLimitInput}
              onChange={(event) => setL2GasLimitInput(event.target.value)}
              placeholder={DEFAULT_L2_GAS_LIMIT.toString()}
            />
          </div>
          <div className="field">
            <label>Max fee per gas (wei)</label>
            <input
              value={l2MaxFeeInput}
              onChange={(event) => setL2MaxFeeInput(event.target.value)}
              placeholder="Leave blank to auto-estimate"
            />
          </div>
          <div className="field">
            <label>Max priority fee per gas (wei)</label>
            <input
              value={l2PriorityFeeInput}
              onChange={(event) => setL2PriorityFeeInput(event.target.value)}
              placeholder="Leave blank to auto-estimate"
            />
          </div>
        </div>
        <div className="field">
          <label>L2 transaction hash (for status/finalize)</label>
          <input
            value={l2TxInput}
            onChange={(event) => setL2TxInput(event.target.value)}
            placeholder="0x…"
          />
        </div>
        <p>
          Withdrawing {amountLabel} from {targetL2Rpc}.
        </p>
      </section>

      <section>
        <h2>Actions</h2>
        <div className="inline-fields">
          <button onClick={quoteWithdrawal} disabled={actionDisabled('quote')}>
            {busy === 'quote' ? 'Quoting…' : 'Quote'}
          </button>
          <button onClick={prepareWithdrawal} disabled={actionDisabled('prepare')}>
            {busy === 'prepare' ? 'Preparing…' : 'Prepare'}
          </button>
          <button onClick={createWithdrawal} disabled={actionDisabled('create')}>
            {busy === 'create' ? 'Submitting…' : 'Create'}
          </button>
          <button
            onClick={checkStatus}
            disabled={actionDisabled('status', { requiresWaitable: true })}
          >
            {busy === 'status' ? 'Checking…' : 'Status'}
          </button>
          <button
            onClick={waitForL2}
            disabled={actionDisabled('waitL2', { requiresWaitable: true })}
          >
            {busy === 'waitL2' ? 'Waiting…' : 'Wait (L2)'}
          </button>
          <button
            onClick={waitForReady}
            disabled={actionDisabled('waitReady', { requiresWaitable: true })}
          >
            {busy === 'waitReady' ? 'Waiting…' : 'Wait (Ready)'}
          </button>
          <button
            onClick={waitForFinalized}
            disabled={actionDisabled('waitFinalized', { requiresWaitable: true })}
          >
            {busy === 'waitFinalized' ? 'Waiting…' : 'Wait (Finalized)'}
          </button>
          <button
            onClick={finalizeWithdrawal}
            disabled={actionDisabled('finalize', { requiresHash: true })}
          >
            {busy === 'finalize' ? 'Submitting…' : 'Finalize on L1'}
          </button>
        </div>
      </section>

      <section className="results">
        <ResultCard title="Quote" data={quote} />
        <ResultCard title="Prepare" data={plan} />
        <ResultCard title="Create" data={handle} />
        <ResultCard title="Status" data={status} />
        <ResultCard title="Wait (L2)" data={waitL2Result} />
        <ResultCard title="Wait (Ready)" data={waitReadyResult} />
        <ResultCard title="Wait (Finalized)" data={waitFinalizedResult} />
        <ResultCard title="Finalize" data={finalizeResult} />
      </section>

      {error && <div className="error">{error}</div>}
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<Example />);
