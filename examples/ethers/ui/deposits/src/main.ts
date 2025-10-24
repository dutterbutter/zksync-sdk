import { BrowserProvider, JsonRpcProvider, parseEther } from 'ethers';
import { createEthersClient, createEthersSdk } from '@dutterbutter/zksync-sdk/ethers';

declare global {
  interface Window {
    ethereum?: any;
  }
}

type TryResult<T> = { ok: true; value: T } | { ok: false; error: unknown };

type EthersSdk = ReturnType<typeof createEthersSdk>;

type DepositsApi = EthersSdk['deposits'] & {
  tryQuote?: (...args: any[]) => Promise<TryResult<any>>;
  tryPrepare?: (...args: any[]) => Promise<TryResult<any>>;
  tryCreate?: (...args: any[]) => Promise<TryResult<any>>;
  tryStatus?: (...args: any[]) => Promise<TryResult<any>>;
  tryWait?: (...args: any[]) => Promise<TryResult<any>>;
};

const mustGet = <T extends HTMLElement>(id: string) => {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`Missing element with id "${id}"`);
  }
  return node as T;
};

const output = mustGet<HTMLPreElement>('log');
const btnConnect = mustGet<HTMLButtonElement>('connect');
const acct = mustGet<HTMLDivElement>('acct');
const route = mustGet<HTMLDivElement>('net');
const l2Rpc = mustGet<HTMLInputElement>('l2Rpc');
const amount = mustGet<HTMLInputElement>('amount');
const recipientInput = mustGet<HTMLInputElement>('to');
const opInput = mustGet<HTMLInputElement>('opid');
const btnQuote = mustGet<HTMLButtonElement>('btn-quote');
const btnPrepare = mustGet<HTMLButtonElement>('btn-prepare');
const btnCreate = mustGet<HTMLButtonElement>('btn-create');
const btnStatus = mustGet<HTMLButtonElement>('btn-status');
const btnWait = mustGet<HTMLButtonElement>('btn-wait');

const DEFAULT_L2 = 'https://sepolia.era.zksync.dev';
const L1_SEPOLIA = 11155111;

const KNOWN_CHAINS: Record<number, string> = {
  1: 'Ethereum Mainnet',
  5: 'Goerli',
  11155111: 'Sepolia',
};

let l1Provider: BrowserProvider | null = null;
let l2Provider: JsonRpcProvider | null = null;
let signer: Awaited<ReturnType<BrowserProvider['getSigner']>> | null = null;
let sdk: EthersSdk | null = null;
let deposits: DepositsApi | null = null;
let lastQuote: any = null;
let lastPrepared: any = null;
let lastCreated: any = null;
let connectInFlight = false;
let walletEventsBound = false;

function chainName(id: number) {
  return KNOWN_CHAINS[id] ?? `Chain ${id}`;
}

function formatLog(entry: unknown): string {
  if (typeof entry === 'string') return entry;
  try {
    return JSON.stringify(entry, null, 2);
  } catch (err) {
    return String(entry);
  }
}

function log(entry: unknown) {
  const text = formatLog(entry);
  output.textContent += `${text}\n\n`;
  output.scrollTop = output.scrollHeight;
}

function shapeError(error: unknown) {
  if (error == null) return { message: 'Unknown error' };
  if (typeof error === 'string') return { message: error };
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  if (typeof error === 'object') {
    const obj = error as Record<string, unknown>;
    const shaped: Record<string, unknown> = {};
    for (const key of ['code', 'message', 'resource', 'operation', 'context', 'cause']) {
      if (obj[key] != null) shaped[key] = obj[key];
    }
    if (Object.keys(shaped).length === 0) {
      try {
        return JSON.parse(JSON.stringify(error));
      } catch {
        return { message: String(error) };
      }
    }
    return shaped;
  }
  return { message: String(error) };
}

function renderRoute(fromChainId: number, rpc: string) {
  const from = `From: ${chainName(fromChainId)} (Injected Wallet, chainId ${fromChainId})`;
  const to = `To: zkSync L2 (RPC: ${rpc || DEFAULT_L2})`;
  route.textContent = `${from} → ${to}`;
}

function isIframe() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

async function ensureSepolia(): Promise<number> {
  if (!l1Provider) throw new Error('Connect your wallet first.');
  const chainHex = await l1Provider.send('eth_chainId', []);
  const current = parseInt(chainHex, 16);
  if (current === L1_SEPOLIA) return current;

  try {
    await l1Provider.send('wallet_switchEthereumChain', [
      { chainId: `0x${L1_SEPOLIA.toString(16)}` },
    ]);
    return L1_SEPOLIA;
  } catch (err: any) {
    if (err?.code === 4902) {
      await l1Provider.send('wallet_addEthereumChain', [
        {
          chainId: `0x${L1_SEPOLIA.toString(16)}`,
          chainName: 'Sepolia',
          nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
          rpcUrls: [
            'https://ethereum-sepolia.publicnode.com',
            'https://rpc.sepolia.org',
          ],
          blockExplorerUrls: ['https://sepolia.etherscan.io'],
        },
      ]);
      return L1_SEPOLIA;
    }
    throw new Error('Switch to L1 Ethereum Sepolia (chainId 11155111) and try again.');
  }
}

async function rebuildSdk(reason?: string): Promise<boolean> {
  if (!l1Provider || !l2Provider || !signer) {
    deposits = null;
    return false;
  }

  const client = createEthersClient({ l1: l1Provider, l2: l2Provider, signer });
  sdk = createEthersSdk(client);
  const resource = (sdk as unknown as { deposits?: DepositsApi }).deposits;
  if (!resource) {
    log('⚠️ Deposits API not available on this SDK version.');
    deposits = null;
    return false;
  }
  deposits = resource;

  lastQuote = null;
  lastPrepared = null;
  lastCreated = null;

  if (reason) log(`SDK rebuilt: ${reason}`);
  return true;
}

async function defaultRecipient() {
  if (!recipientInput.value.trim() && signer) {
    const addr = await signer.getAddress();
    recipientInput.value = addr;
  }
}

async function handleTry<T>(label: string, actions: {
  tryCall?: () => Promise<TryResult<T>>;
  fallback?: () => Promise<T>;
}): Promise<{ success: true; value: T } | { success: false }> {
  try {
    if (actions.tryCall) {
      const result = await actions.tryCall();
      if (result.ok) {
        log({ [label]: result.value });
        return { success: true, value: result.value };
      }
      log({ [`${label}Error`]: shapeError(result.error) });
      return { success: false };
    }

    if (!actions.fallback) {
      log(`${label}: method not available.`);
      return { success: false };
    }

    const value = await actions.fallback();
    log({ [label]: value });
    return { success: true, value };
  } catch (error) {
    log({ [`${label}Error`]: shapeError(error) });
    return { success: false };
  }
}

function requireDeposits() {
  if (!deposits) throw new Error('Connect wallet first.');
  return deposits;
}

renderRoute(L1_SEPOLIA, DEFAULT_L2);
l2Rpc.value = DEFAULT_L2;

btnConnect.addEventListener('click', async () => {
  if (connectInFlight) return;
  connectInFlight = true;
  btnConnect.disabled = true;

  try {
    log('Connect clicked.');

    if (!window.ethereum) {
      alert('No injected wallet detected. Install MetaMask or open in a wallet-enabled browser.');
      return;
    }

    if (isIframe()) {
      log('⚠️ Detected iframe. If the wallet prompt does not appear, open this demo in a new window.');
    }

    const hasRequest = typeof window.ethereum.request === 'function';
    const hasSend = typeof window.ethereum.send === 'function';

    if (!hasRequest && !hasSend) {
      log('Wallet provider does not expose request/send methods.');
      alert('Injected wallet does not support the eth_requestAccounts RPC.');
      return;
    }

    log('Requesting account access…');
    if (hasRequest) {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
    } else if (hasSend) {
      await window.ethereum.send('eth_requestAccounts', []);
    }

    l1Provider = new BrowserProvider(window.ethereum);
    signer = await l1Provider.getSigner();

    const chainId = await ensureSepolia();

    const address = await signer.getAddress();
    acct.textContent = `Connected: ${address}`;

    const rpc = l2Rpc.value.trim() || DEFAULT_L2;
    l2Provider = new JsonRpcProvider(rpc);
    renderRoute(chainId, rpc);

    const ready = await rebuildSdk('connected');
    await defaultRecipient();
    if (ready) {
      log('SDK ready (ethers).');
    } else {
      log('⚠️ SDK not ready. Connect again once providers are set.');
    }

    if (!walletEventsBound) {
      walletEventsBound = true;
      window.ethereum?.on?.('chainChanged', async (hex: string) => {
        const newId = parseInt(hex, 16);
        renderRoute(newId, l2Rpc.value.trim() || DEFAULT_L2);
        if (newId !== L1_SEPOLIA) {
          log(`Switched to chain ${newId}. Waiting for Sepolia...`);
        }
      });
      window.ethereum?.on?.('accountsChanged', async (accounts: string[]) => {
        if (!accounts || accounts.length === 0) {
          acct.textContent = 'Not connected';
          recipientInput.value = '';
          return;
        }
        const next = accounts[0];
        acct.textContent = `Connected: ${next}`;
        if (!recipientInput.value.trim()) {
          recipientInput.value = next;
        }
      });
    }
  } catch (error) {
    const shaped = shapeError(error);
    log({ connectError: shaped });
    alert(shaped.message ?? String(error));
  } finally {
    connectInFlight = false;
    btnConnect.disabled = false;
  }
});

l2Rpc.addEventListener('change', async () => {
  const rpc = l2Rpc.value.trim() || DEFAULT_L2;
  let fromId = L1_SEPOLIA;
  if (l1Provider) {
    try {
      const hex = await l1Provider.send('eth_chainId', []);
      fromId = parseInt(hex, 16);
    } catch {
      fromId = L1_SEPOLIA;
    }
  }
  renderRoute(fromId, rpc);
  l2Provider = new JsonRpcProvider(rpc);
  const ready = await rebuildSdk('updated L2 RPC');
  if (!ready) {
    log('Reconnect wallet to rebuild SDK with the updated L2 RPC.');
  }
});

btnQuote.addEventListener('click', async () => {
  try {
    const dep = requireDeposits();
    const chainId = await ensureSepolia();
    renderRoute(chainId, l2Rpc.value.trim() || DEFAULT_L2);
    await defaultRecipient();

    const to = recipientInput.value.trim() || (signer ? await signer.getAddress() : '');
    const amtStr = amount.value?.trim() || '0.01';
    const amt = parseEther(amtStr);

    const params = { asset: 'ETH', amount: amt, to };
    const result = await handleTry('quote', {
      tryCall: dep.tryQuote ? () => dep.tryQuote!(params) : undefined,
      fallback: dep.quote ? () => dep.quote(params) : undefined,
    });
    if (result.success) {
      lastQuote = result.value;
    }
  } catch (error) {
    log({ quoteError: shapeError(error) });
  }
});

btnPrepare.addEventListener('click', async () => {
  try {
    const dep = requireDeposits();
    if (!lastQuote) {
      alert('Quote first.');
      return;
    }

    const chainId = await ensureSepolia();
    renderRoute(chainId, l2Rpc.value.trim() || DEFAULT_L2);
    await defaultRecipient();

    const to = recipientInput.value.trim() || (signer ? await signer.getAddress() : '');
    const amtStr = amount.value?.trim() || '0.01';
    const amt = parseEther(amtStr);

    const params = { asset: 'ETH', amount: amt, to, quote: lastQuote };
    const result = await handleTry('prepare', {
      tryCall: dep.tryPrepare ? () => dep.tryPrepare!(params) : undefined,
      fallback: dep.prepare ? () => dep.prepare(params) : undefined,
    });
    if (result.success) {
      lastPrepared = result.value;
    }
  } catch (error) {
    log({ prepareError: shapeError(error) });
  }
});

btnCreate.addEventListener('click', async () => {
  try {
    const dep = requireDeposits();
    if (!lastPrepared) {
      alert('Prepare first.');
      return;
    }

    const chainId = await ensureSepolia();
    renderRoute(chainId, l2Rpc.value.trim() || DEFAULT_L2);

    const result = await handleTry('create', {
      tryCall: dep.tryCreate ? () => dep.tryCreate!(lastPrepared) : undefined,
      fallback: dep.create ? () => dep.create(lastPrepared) : undefined,
    });

    if (result.success) {
      lastCreated = result.value;
      const opId = (result.value as any)?.operationId ?? (result.value as any)?.operationID;
      const l1TxHash = (result.value as any)?.l1TxHash ?? (result.value as any)?.txHash;
      if (opId) {
        opInput.value = opId;
        log({ operationId: opId });
      }
      if (l1TxHash) {
        log({ l1TxHash });
      }
    }
  } catch (error) {
    log({ createError: shapeError(error) });
  }
});

btnStatus.addEventListener('click', async () => {
  try {
    const dep = requireDeposits();
    const handle = opInput.value.trim();
    if (!handle) {
      alert('Enter an operation ID.');
      return;
    }

    const chainId = await ensureSepolia();
    renderRoute(chainId, l2Rpc.value.trim() || DEFAULT_L2);

    await handleTry('status', {
      tryCall: dep.tryStatus ? () => dep.tryStatus!(handle) : undefined,
      fallback: dep.status ? () => dep.status(handle) : undefined,
    });
  } catch (error) {
    log({ statusError: shapeError(error) });
  }
});

btnWait.addEventListener('click', async () => {
  try {
    const dep = requireDeposits();
    const handle = opInput.value.trim();
    if (!handle) {
      alert('Enter an operation ID.');
      return;
    }

    const chainId = await ensureSepolia();
    renderRoute(chainId, l2Rpc.value.trim() || DEFAULT_L2);

    const waitOpts = {
      target: 'finalized',
      pollIntervalMs: 4000,
      timeoutMs: 600_000,
    } as const;

    await handleTry('wait', {
      tryCall: dep.tryWait ? () => dep.tryWait!(handle, waitOpts) : undefined,
      fallback: dep.wait ? () => dep.wait(handle, waitOpts) : undefined,
    });
  } catch (error) {
    log({ waitError: shapeError(error) });
  }
});
