import { useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import {
  BrowserProvider,
  JsonRpcProvider,
  type JsonRpcSigner,
  type TransactionReceipt,
  formatEther,
  parseEther,
} from 'ethers';

import { createEthersClient } from '../../../../src/adapters/ethers/client';
import { createEthersSdk, type EthersSdk } from '../../../../src/adapters/ethers/sdk';
import type {
  DepositHandle,
  DepositPlan,
  DepositQuote,
  DepositStatus,
} from '../../../../src/core/types/flows/deposits';
import type { Address } from '../../../../src/core/types/primitives';
import { ETH_ADDRESS } from '../../../../src/core/constants';

declare global {
  interface Window {
    ethereum?: unknown;
  }
}

type Action = 'connect' | 'quote' | 'prepare' | 'create' | 'status' | 'wait';

const DEFAULT_L1_RPC = 'https://ethereum-sepolia-rpc.publicnode.com';
const DEFAULT_L2_RPC = 'https://zksync-os-testnet-alpha.zksync.dev/';
const DEFAULT_L1_GAS_LIMIT = 300_000n;

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
  data: unknown;
}

function ResultCard({ title, data }: ResultCardProps) {
  if (data === undefined) return null;
  return (
    <section>
      <h3>{title}</h3>
      <pre>
        <code>{stringify(data)}</code>
      </pre>
    </section>
  );
}

function Example() {
  const [account, setAccount] = useState<Address>();
  const [chainId, setChainId] = useState<number>();
  const [sdk, setSdk] = useState<EthersSdk>();
  const [l1Provider, setL1Provider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [connectedL2Rpc, setConnectedL2Rpc] = useState<string>(DEFAULT_L2_RPC);
  const [quote, setQuote] = useState<DepositQuote>();
  const [plan, setPlan] = useState<DepositPlan<unknown>>();
  const [handle, setHandle] = useState<DepositHandle<unknown>>();
  const [status, setStatus] = useState<DepositStatus>();
  const [receipt, setReceipt] = useState<TransactionReceipt | null | undefined>(undefined);
  const [error, setError] = useState<string>();
  const [l2Rpc, setL2Rpc] = useState(DEFAULT_L2_RPC);
  const [amount, setAmount] = useState('0.001');
  const [recipient, setRecipient] = useState('');
  const [l1GasLimitInput, setL1GasLimitInput] = useState(DEFAULT_L1_GAS_LIMIT.toString());
  const [l1MaxFeeInput, setL1MaxFeeInput] = useState('');
  const [l1PriorityFeeInput, setL1PriorityFeeInput] = useState('');
  const [busy, setBusy] = useState<Action | null>(null);

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
    if (chainId === 11155111) return `Sepolia (${chainId})`;
    if (chainId === 1) return `Mainnet (${chainId})`;
    return `${chainId}`;
  }, [chainId]);

  const buildParams = () => {
    if (!account) throw new Error('Connect wallet first.');

    const trimmedAmount = amount.trim();
    if (!trimmedAmount) throw new Error('Provide an amount in ETH.');

    let parsedAmount: bigint;
    try {
      parsedAmount = parseEther(trimmedAmount);
    } catch {
      throw new Error('Amount must be a valid ETH value.');
    }

    const destination = (recipient.trim() || account) as Address;

    const overrides = {
      gasLimit: l1GasLimitInput.trim()
        ? parseOptionalBigInt(l1GasLimitInput, 'Gas limit')
        : undefined,
      maxFeePerGas: l1MaxFeeInput.trim()
        ? parseOptionalBigInt(l1MaxFeeInput, 'Max fee per gas')
        : undefined,
      maxPriorityFeePerGas: l1PriorityFeeInput.trim()
        ? parseOptionalBigInt(l1PriorityFeeInput, 'Max priority fee per gas')
        : undefined,
    };

    const hasOverrides = Object.values(overrides).some((value) => value != null);

    return {
      amount: parsedAmount,
      token: ETH_ADDRESS,
      to: destination,
      ...(hasOverrides ? { l1TxOverrides: overrides } : {}),
    } as const;
  };

  const connect = async () => {
    setBusy('connect');
    setError(undefined);
    try {
      if (!window.ethereum) {
        throw new Error('No injected wallet found. Install MetaMask or a compatible wallet.');
      }

      const browserProvider = new BrowserProvider(window.ethereum);
      await browserProvider.send('eth_requestAccounts', []);
      const signer = (await browserProvider.getSigner()) as JsonRpcSigner;
      const addr = (await signer.getAddress()) as Address;
      const network = await browserProvider.getNetwork();
      const l2Provider = new JsonRpcProvider(targetL2Rpc);

      const client = createEthersClient({ l1: browserProvider, l2: l2Provider, signer });
      const instance = createEthersSdk(client);

      setSdk(instance);
      setL1Provider(browserProvider);
      setSigner(signer);
      setConnectedL2Rpc(targetL2Rpc);
      setAccount(addr);
      setChainId(Number(network.chainId));
      setRecipient((prev) => prev || addr);
      setQuote(undefined);
      setPlan(undefined);
      setHandle(undefined);
      setStatus(undefined);
      setReceipt(undefined);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const refreshSdkIfNeeded = async (): Promise<EthersSdk> => {
    if (!l1Provider || !signer) {
      throw new Error('Connect wallet first.');
    }
    if (sdk && connectedL2Rpc === targetL2Rpc) {
      return sdk;
    }
    const l2Provider = new JsonRpcProvider(targetL2Rpc);
    const client = createEthersClient({ l1: l1Provider, l2: l2Provider, signer });
    const instance = createEthersSdk(client);
    setSdk(instance);
    setConnectedL2Rpc(targetL2Rpc);
    return instance;
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

  const quoteDeposit = async () => {
    if (!sdk && (!l1Provider || !signer)) {
      setError('Connect wallet first.');
      return;
    }
    await run(
      'quote',
      async () => {
        const currentSdk = await refreshSdkIfNeeded();
        const params = buildParams();
        const result = await currentSdk.deposits.tryQuote(params);
        if (!result.ok) throw result.error;
        return result.value;
      },
      (value) => setQuote(value),
    );
  };

  const prepareDeposit = async () => {
    if (!sdk && (!l1Provider || !signer)) {
      setError('Connect wallet first.');
      return;
    }
    await run(
      'prepare',
      async () => {
        const currentSdk = await refreshSdkIfNeeded();
        const params = buildParams();
        const result = await currentSdk.deposits.tryPrepare(params);
        if (!result.ok) throw result.error;
        return result.value;
      },
      (value) => setPlan(value),
    );
  };

  const createDeposit = async () => {
    if (!sdk && (!l1Provider || !signer)) {
      setError('Connect wallet first.');
      return;
    }
    await run(
      'create',
      async () => {
        const currentSdk = await refreshSdkIfNeeded();
        const params = buildParams();
        const result = await currentSdk.deposits.tryCreate(params);
        if (!result.ok) throw result.error;
        return result.value;
      },
      (value) => {
        setHandle(value);
        setStatus(undefined);
        setReceipt(undefined);
      },
    );
  };

  const checkStatus = async () => {
    if (!handle) {
      setError('Create a deposit first to request status.');
      return;
    }
    await run(
      'status',
      async () => {
        const currentSdk = await refreshSdkIfNeeded();
        return currentSdk.deposits.status(handle);
      },
      (value) => setStatus(value),
    );
  };

  const waitForL2 = async () => {
    if (!handle) {
      setError('Create a deposit first to wait for finalization.');
      return;
    }
    await run(
      'wait',
      async () => {
        const currentSdk = await refreshSdkIfNeeded();
        return currentSdk.deposits.wait(handle, { for: 'l2' });
      },
      (value) => setReceipt(value ?? null),
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
        <h2>Deposit Parameters</h2>
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
            <span>Recipient (defaults to connected account)</span>
            <input
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              spellCheck={false}
              placeholder={account}
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
            <legend style={{ padding: '0 0.3rem', fontWeight: 600 }}>L1 Overrides (wei)</legend>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span>Gas Limit</span>
              <input
                value={l1GasLimitInput}
                onChange={(event) => setL1GasLimitInput(event.target.value)}
                spellCheck={false}
                style={{ minWidth: '420px', maxWidth: '100%' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span>Max Fee Per Gas</span>
              <input
                value={l1MaxFeeInput}
                onChange={(event) => setL1MaxFeeInput(event.target.value)}
                spellCheck={false}
                placeholder="Leave blank to auto-estimate"
                style={{ minWidth: '420px', maxWidth: '100%' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span>Max Priority Fee Per Gas</span>
              <input
                value={l1PriorityFeeInput}
                onChange={(event) => setL1PriorityFeeInput(event.target.value)}
                spellCheck={false}
                placeholder="Leave blank to auto-estimate"
                style={{ minWidth: '420px', maxWidth: '100%' }}
              />
            </label>
          </fieldset>
        </div>
        <p style={{ marginTop: '1rem' }}>
          Depositing {amountLabel} from Sepolia L1 to {targetL2Rpc}.
        </p>
      </section>

      <section>
        <h2>Actions</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <button onClick={quoteDeposit} disabled={busy !== null}>
            {busy === 'quote' ? 'Fetching…' : 'Quote'}
          </button>
          <button onClick={prepareDeposit} disabled={busy !== null}>
            {busy === 'prepare' ? 'Building…' : 'Prepare'}
          </button>
          <button onClick={createDeposit} disabled={busy !== null}>
            {busy === 'create' ? 'Submitting…' : 'Create'}
          </button>
          <button onClick={checkStatus} disabled={busy !== null}>
            {busy === 'status' ? 'Checking…' : 'Status'}
          </button>
          <button onClick={waitForL2} disabled={busy !== null}>
            {busy === 'wait' ? 'Waiting…' : 'Wait (L2)'}
          </button>
        </div>
      </section>

      <ResultCard title="Quote" data={quote} />
      <ResultCard title="Prepare" data={plan} />
      <ResultCard title="Create" data={handle} />
      <ResultCard title="Status" data={status} />
      <ResultCard title="Wait (L2)" data={receipt} />

      {error && (
        <section className="error">
          <div>Error: {error}</div>
        </section>
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<Example />);
