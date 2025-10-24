import { useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import {
  type Address,
  type Chain,
  type Hex,
  type TransactionReceipt,
  createPublicClient,
  createWalletClient,
  custom,
  formatEther,
  http,
  parseEther,
  stringify,
} from 'viem';
import { sepolia } from 'viem/chains';
import 'viem/window';

import { createViemClient } from '../../../../src/adapters/viem/client';
import { createViemSdk, type ViemSdk } from '../../../../src/adapters/viem/sdk';
import type {
  WithdrawHandle,
  WithdrawPlan,
  WithdrawQuote,
  WithdrawalStatus,
} from '../../../../src/core/types/flows/withdrawals';
import { ETH_ADDRESS } from '../../../../src/core/constants';

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

const l1Client = createPublicClient({
  chain: sepolia,
  transport: http(DEFAULT_L1_RPC),
});

const stringifyValue = (value: unknown) =>
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

const makeZkSyncChain = (rpc: string): Chain => ({
  id: 300,
  name: 'zkSync Sepolia',
  network: 'zksync-sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [rpc] },
    public: { http: [rpc] },
  },
  blockExplorers: {
    default: { name: 'zkSync Explorer', url: 'https://sepolia.explorer.zksync.io' },
  },
  testnet: true,
});

interface ResultCardProps {
  title: string;
  data: unknown;
}

function ResultCard({ title, data }: ResultCardProps) {
  if (data === undefined) return null;
  return (
    <section>
      <h3>{title}</h3>
      <pre>
        <code>{stringifyValue(data)}</code>
      </pre>
    </section>
  );
}

function Example() {
  const [account, setAccount] = useState<Address>();
  const [chainId, setChainId] = useState<number>();
  const [sdk, setSdk] = useState<ViemSdk>();
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

  const chainLabel = useMemo(() => {
    if (!chainId) return '—';
    if (chainId === sepolia.id) return `Sepolia (${chainId})`;
    if (chainId === 1) return `Mainnet (${chainId})`;
    return `${chainId}`;
  }, [chainId]);

  const buildParams = () => {
    if (!account) throw new Error('Connect wallet first.');

    const trimmedAmount = amount.trim();
    if (!trimmedAmount) throw new Error('Provide an amount in ETH.');

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
  };

  const resolveWaitable = () => {
    const trimmed = l2TxInput.trim();
    if (trimmed) return trimmed as Hex;
    if (handle) return handle;
    return null;
  };

  const resolveL2Hash = () => {
    const trimmed = l2TxInput.trim();
    if (trimmed) return trimmed as Hex;
    if (handle?.l2TxHash) return handle.l2TxHash as Hex;
    return null;
  };

  const connect = async () => {
    setBusy('connect');
    setError(undefined);
    try {
      if (!window.ethereum) {
        throw new Error('No injected wallet found. Install MetaMask or a compatible wallet.');
      }

      const transport = custom(window.ethereum);
      const bootstrap = createWalletClient({ chain: sepolia, transport });
      const [addr] = await bootstrap.requestAddresses();
      if (!addr) throw new Error('Wallet returned no accounts.');

      const l1Wallet = createWalletClient({
        account: addr,
        chain: sepolia,
        transport,
      });

      const zkSyncChain = makeZkSyncChain(targetL2Rpc);
      const l2Public = createPublicClient({ chain: zkSyncChain, transport: http(targetL2Rpc) });
      const l2Wallet = createWalletClient({
        account: addr,
        chain: zkSyncChain,
        transport,
      });

      const client = createViemClient({ l1: l1Client, l2: l2Public, l1Wallet, l2Wallet });
      const instance = createViemSdk(client);

      const chain = await l1Wallet.getChainId().catch(() => undefined);

      setSdk(instance);
      setAccount(addr as Address);
      setChainId(chain ? Number(chain) : undefined);
      setRecipient((prev) => prev || (addr as Address));
      setQuote(undefined);
      setPlan(undefined);
      setHandle(undefined);
      setStatus(undefined);
      setWaitL2Result(undefined);
      setWaitReadyResult(undefined);
      setWaitFinalizedResult(undefined);
      setFinalizeResult(undefined);
      setL2TxInput('');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const run = async <T,>(action: Action, fn: () => Promise<T>, onSuccess?: (value: T) => void) => {
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
  };

  const quoteWithdrawal = async () => {
    if (!sdk) return;
    await run(
      'quote',
      async () => {
        const params = buildParams();
        const result = await sdk.withdrawals.tryQuote(params);
        if (!result.ok) throw result.error;
        return result.value;
      },
      (value) => setQuote(value),
    );
  };

  const prepareWithdrawal = async () => {
    if (!sdk) return;
    await run(
      'prepare',
      async () => {
        const params = buildParams();
        const result = await sdk.withdrawals.tryPrepare(params);
        if (!result.ok) throw result.error;
        return result.value;
      },
      (value) => setPlan(value),
    );
  };

  const createWithdrawal = async () => {
    if (!sdk) return;
    await run(
      'create',
      async () => {
        const params = buildParams();
        const result = await sdk.withdrawals.tryCreate(params);
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
    );
  };

  const checkStatus = async () => {
    if (!sdk) return;
    const waitable = resolveWaitable();
    if (!waitable) {
      setError('Provide an L2 transaction hash or create a withdrawal first.');
      return;
    }
    await run(
      'status',
      async () => sdk.withdrawals.status(waitable),
      (value) => setStatus(value),
    );
  };

  const waitForL2 = async () => {
    if (!sdk) return;
    const waitable = resolveWaitable();
    if (!waitable) {
      setError('Provide an L2 transaction hash or create a withdrawal first.');
      return;
    }
    await run(
      'waitL2',
      async () => sdk.withdrawals.wait(waitable, { for: 'l2' }),
      (value) => setWaitL2Result(value),
    );
  };

  const waitForReady = async () => {
    if (!sdk) return;
    const waitable = resolveWaitable();
    if (!waitable) {
      setError('Provide an L2 transaction hash or create a withdrawal first.');
      return;
    }
    await run(
      'waitReady',
      async () => sdk.withdrawals.wait(waitable, { for: 'ready' }),
      (value) => setWaitReadyResult(value ?? { ready: true }),
    );
  };

  const waitForFinalized = async () => {
    if (!sdk) return;
    const waitable = resolveWaitable();
    if (!waitable) {
      setError('Provide an L2 transaction hash or create a withdrawal first.');
      return;
    }
    await run(
      'waitFinalized',
      async () => sdk.withdrawals.wait(waitable, { for: 'finalized' }),
      (value) => setWaitFinalizedResult(value ?? null),
    );
  };

  const finalizeWithdrawal = async () => {
    if (!sdk) return;
    const hash = resolveL2Hash();
    if (!hash) {
      setError('Provide an L2 transaction hash or create a withdrawal first.');
      return;
    }
    await run(
      'finalize',
      async () => {
        const result = await sdk.withdrawals.tryFinalize(hash as Hex);
        if (!result.ok) throw result.error;
        return result.value;
      },
      (value) => setFinalizeResult(value),
    );
  };

  if (!account) {
    return (
      <>
        <section>
          <h2>Wallet</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
            <div>L1 RPC: {DEFAULT_L1_RPC}</div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxWidth: '100%' }}>
              <span>L2 RPC:</span>
              <input
                value={l2Rpc}
                onChange={(event) => setL2Rpc(event.target.value)}
                spellCheck={false}
                style={{ minWidth: '420px', maxWidth: '100%' }}
              />
            </label>
          </div>
          <button onClick={connect} disabled={busy === 'connect'}>
            {busy === 'connect' ? 'Connecting…' : 'Connect Wallet'}
          </button>
        </section>
        {error && (
          <section className="error">
            <div>Error: {error}</div>
          </section>
        )}
      </>
    );
  }

  return (
    <>
      <section>
        <h2>Wallet</h2>
        <div>Connected: {account}</div>
        <div>Wallet Chain: {chainLabel}</div>
        <div>L1 RPC: {DEFAULT_L1_RPC}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxWidth: '100%', marginTop: '0.5rem' }}>
          <span>L2 RPC:</span>
          <input
            value={l2Rpc}
            onChange={(event) => setL2Rpc(event.target.value)}
            spellCheck={false}
            style={{ minWidth: '420px', maxWidth: '100%' }}
          />
        </div>
      </section>

      <section>
        <h2>Withdrawal Parameters</h2>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            maxWidth: '520px',
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <span>Amount (ETH)</span>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              spellCheck={false}
              inputMode="decimal"
              style={{ minWidth: '420px', maxWidth: '100%' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <span>Token Address</span>
            <input
              value={token}
              onChange={(event) => setToken(event.target.value)}
              spellCheck={false}
              style={{ minWidth: '420px', maxWidth: '100%' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <span>Recipient (defaults to connected account)</span>
            <input
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              spellCheck={false}
              placeholder={account}
              style={{ minWidth: '420px', maxWidth: '100%' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <span>L2 Gas Limit</span>
            <input
              value={l2GasLimitInput}
              onChange={(event) => setL2GasLimitInput(event.target.value)}
              spellCheck={false}
              style={{ minWidth: '420px', maxWidth: '100%' }}
            />
          </label>
          <fieldset
            style={{
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              padding: '0.75rem 1rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <legend style={{ padding: '0 0.3rem', fontWeight: 600 }}>L2 Tx Overrides (wei)</legend>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span>Max Fee Per Gas</span>
              <input
                value={l2MaxFeeInput}
                onChange={(event) => setL2MaxFeeInput(event.target.value)}
                spellCheck={false}
                placeholder="Leave blank to auto-estimate"
                style={{ minWidth: '420px', maxWidth: '100%' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span>Max Priority Fee Per Gas</span>
              <input
                value={l2PriorityFeeInput}
                onChange={(event) => setL2PriorityFeeInput(event.target.value)}
                spellCheck={false}
                placeholder="Leave blank to auto-estimate"
                style={{ minWidth: '420px', maxWidth: '100%' }}
              />
            </label>
          </fieldset>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <span>L2 Transaction Hash (for status/finalize)</span>
            <input
              value={l2TxInput}
              onChange={(event) => setL2TxInput(event.target.value)}
              spellCheck={false}
              placeholder="0x…"
              style={{ minWidth: '420px', maxWidth: '100%' }}
            />
          </label>
        </div>
        <p style={{ marginTop: '1rem' }}>
          Withdrawing {amountLabel} from {targetL2Rpc}.
        </p>
      </section>

      <section>
        <h2>Actions</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <button onClick={quoteWithdrawal} disabled={busy !== null}>
            {busy === 'quote' ? 'Fetching…' : 'Quote'}
          </button>
          <button onClick={prepareWithdrawal} disabled={busy !== null}>
            {busy === 'prepare' ? 'Building…' : 'Prepare'}
          </button>
          <button onClick={createWithdrawal} disabled={busy !== null}>
            {busy === 'create' ? 'Submitting…' : 'Create'}
          </button>
          <button onClick={checkStatus} disabled={busy !== null}>
            {busy === 'status' ? 'Checking…' : 'Status'}
          </button>
          <button onClick={waitForL2} disabled={busy !== null}>
            {busy === 'waitL2' ? 'Waiting…' : 'Wait (L2)'}
          </button>
          <button onClick={waitForReady} disabled={busy !== null}>
            {busy === 'waitReady' ? 'Waiting…' : 'Wait (Ready)'}
          </button>
          <button onClick={waitForFinalized} disabled={busy !== null}>
            {busy === 'waitFinalized' ? 'Waiting…' : 'Wait (Finalized)'}
          </button>
          <button onClick={finalizeWithdrawal} disabled={busy !== null}>
            {busy === 'finalize' ? 'Submitting…' : 'Finalize on L1'}
          </button>
        </div>
      </section>

      <ResultCard title="Quote" data={quote} />
      <ResultCard title="Prepare" data={plan} />
      <ResultCard title="Create" data={handle} />
      <ResultCard title="Status" data={status} />
      <ResultCard title="Wait (L2)" data={waitL2Result} />
      <ResultCard title="Wait (Ready)" data={waitReadyResult} />
      <ResultCard title="Wait (Finalized)" data={waitFinalizedResult} />
      <ResultCard title="Finalize" data={finalizeResult} />

      {error && (
        <section className="error">
          <div>Error: {error}</div>
        </section>
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<Example />);
