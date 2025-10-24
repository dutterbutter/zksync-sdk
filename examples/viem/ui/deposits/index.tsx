import { useState } from 'react';
import ReactDOM from 'react-dom/client';
import {
  type Address,
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
  DepositHandle,
  DepositPlan,
  DepositQuote,
  DepositStatus,
} from '../../../../src/core/types/flows/deposits';
import { ETH_ADDRESS } from '../../../../src/core/constants';

const DEFAULT_L1_RPC = 'https://ethereum-sepolia-rpc.publicnode.com';
const DEFAULT_L2_RPC = 'https://zksync-os-testnet-alpha.zksync.dev/';

const l1 = createPublicClient({
  chain: sepolia,
  transport: http(DEFAULT_L1_RPC),
});

const transport = custom(window.ethereum!);
const DEFAULT_L1_GAS_LIMIT = 300_000n;

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

function Example() {
  const [account, setAccount] = useState<Address>();
  const [sdk, setSdk] = useState<ViemSdk>();
  const [quote, setQuote] = useState<DepositQuote>();
  const [plan, setPlan] = useState<DepositPlan<unknown>>();
  const [handle, setHandle] = useState<DepositHandle<unknown>>();
  const [status, setStatus] = useState<DepositStatus>();
  const [receipt, setReceipt] = useState<TransactionReceipt | null>(null);
  const [error, setError] = useState<string>();
  const [l2Rpc, setL2Rpc] = useState(DEFAULT_L2_RPC);
  const [amount, setAmount] = useState('0.001');
  const [recipient, setRecipient] = useState('');
  const [l1GasLimitInput, setL1GasLimitInput] = useState(DEFAULT_L1_GAS_LIMIT.toString());
  const [l1MaxFeeInput, setL1MaxFeeInput] = useState('');
  const [l1PriorityFeeInput, setL1PriorityFeeInput] = useState('');

  const targetL2Rpc = l2Rpc.trim() || DEFAULT_L2_RPC;
  const amountLabel = (() => {
    const trimmed = amount.trim();
    if (!trimmed) return '—';
    try {
      return describeAmount(parseEther(trimmed));
    } catch {
      return '—';
    }
  })();

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
      gasLimit: (() => {
        if (!l1GasLimitInput.trim()) return undefined;
        try {
          return parseOptionalBigInt(l1GasLimitInput, 'Gas limit');
        } catch (err) {
          throw err;
        }
      })(),
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
    try {
      const bootstrap = createWalletClient({ chain: sepolia, transport });
      const [addr] = await bootstrap.requestAddresses();
      if (!addr) throw new Error('Wallet returned no accounts.');

      const l1Wallet = createWalletClient({
        account: addr,
        chain: sepolia,
        transport,
      });

      const l2Client = createPublicClient({
        transport: http(targetL2Rpc),
      });

      const client = createViemClient({ l1, l2: l2Client, l1Wallet });
      setSdk(createViemSdk(client));
      setAccount(addr);
      setRecipient((prev) => prev || addr);
      setQuote(undefined);
      setPlan(undefined);
      setHandle(undefined);
      setStatus(undefined);
      setReceipt(null);
      setError(undefined);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const quoteDeposit = async () => {
    if (!sdk) return;
    try {
      const built = buildParams();
      const result = await sdk.deposits.tryQuote(built);
      if (!result.ok) throw result.error;
      setQuote(result.value);
      setError(undefined);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const prepareDeposit = async () => {
    if (!sdk) return;
    try {
      const built = buildParams();
      const result = await sdk.deposits.tryPrepare(built);
      if (!result.ok) throw result.error;
      setPlan(result.value);
      setError(undefined);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const createDeposit = async () => {
    if (!sdk) return;
    try {
      const built = buildParams();
      const result = await sdk.deposits.tryCreate(built);
      if (!result.ok) throw result.error;
      const nextHandle = result.value;
      setHandle(nextHandle);
      setStatus(undefined);
      setReceipt(null);
      setError(undefined);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const checkStatus = async () => {
    if (!sdk || !handle) return;
    try {
      setStatus(await sdk.deposits.status(handle));
      setError(undefined);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const waitForL2 = async () => {
    if (!sdk || !handle) return;
    try {
      setReceipt(await sdk.deposits.wait(handle, { for: 'l2' }));
      setError(undefined);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  if (!account) {
    return (
      <>
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
        <button onClick={connect}>Connect Wallet</button>
        {error && <p>Error: {error}</p>}
      </>
    );
  }

  return (
    <>
      <div>Connected: {account}</div>
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
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          marginTop: '1rem',
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
      <p>
        Depositing {amountLabel} from Sepolia L1 to {targetL2Rpc}.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
        <button onClick={quoteDeposit}>Quote</button>
        <button onClick={prepareDeposit}>Prepare</button>
        <button onClick={createDeposit}>Create</button>
        <button onClick={checkStatus}>Status</button>
        <button onClick={waitForL2}>Wait (L2)</button>
      </div>
      {quote && (
        <section>
          <h3>Quote</h3>
          <pre>
            <code>{stringify(quote, null, 2)}</code>
          </pre>
        </section>
      )}
      {plan && (
        <section>
          <h3>Prepare</h3>
          <pre>
            <code>{stringify(plan, null, 2)}</code>
          </pre>
        </section>
      )}
      {handle && (
        <section>
          <h3>Create</h3>
          <pre>
            <code>{stringify(handle, null, 2)}</code>
          </pre>
        </section>
      )}
      {status && (
        <section>
          <h3>Status</h3>
          <pre>
            <code>{stringify(status, null, 2)}</code>
          </pre>
        </section>
      )}
      {receipt && (
        <section>
          <h3>Wait (L2)</h3>
          <pre>
            <code>{stringify(receipt, null, 2)}</code>
          </pre>
        </section>
      )}
      {error && <p>Error: {error}</p>}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<Example />);
