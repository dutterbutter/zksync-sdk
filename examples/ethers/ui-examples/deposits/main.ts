import { BrowserProvider, JsonRpcProvider, formatEther, parseEther } from 'ethers';
import { createEthersClient } from '../../../../src/adapters/ethers/client';
import { createEthersSdk } from '../../../../src/adapters/ethers/sdk';
import { ETH_ADDRESS } from '../../../../src/core/constants';

declare global {
  interface Window {
    ethereum?: any;
  }
}

type CardId = 'card-quote' | 'card-prepare' | 'card-create' | 'card-status' | 'card-wait';

const CARD_TITLES: Record<CardId, string> = {
  'card-quote': 'Quote',
  'card-prepare': 'Prepare',
  'card-create': 'Create',
  'card-status': 'Status',
  'card-wait': 'Wait',
};

const el = <T extends HTMLElement>(id: string) => {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`Missing element #${id}`);
  }
  return node as T;
};

const stringify = (value: unknown) =>
  JSON.stringify(
    value,
    (_, v) => {
      if (typeof v === 'bigint') return v.toString();
      return v;
    },
    2,
  );

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const setTxt = (node: HTMLElement, txt: string) => {
  node.textContent = txt;
};

const DEFAULT_DEPOSIT_AMOUNT = '0.01';

const btnConnect = el<HTMLButtonElement>('connect');
const acct = el<HTMLSpanElement>('acct');
const net = el<HTMLDivElement>('net');
const l2Rpc = el<HTMLInputElement>('l2Rpc');
const amount = el<HTMLInputElement>('amount');
const to = el<HTMLInputElement>('to');
const opid = el<HTMLInputElement>('opid');
const btnQuote = el<HTMLButtonElement>('btn-quote');
const btnPrepare = el<HTMLButtonElement>('btn-prepare');
const btnCreate = el<HTMLButtonElement>('btn-create');
const btnStatus = el<HTMLButtonElement>('btn-status');
const btnWait = el<HTMLButtonElement>('btn-wait');
const createMeta = el<HTMLDivElement>('create-meta');

// State
let l1Provider: BrowserProvider | null = null;
let l2Provider: JsonRpcProvider | null = null;
let signer: any = null;
let sdk: any = null;
let lastParams: { amount: bigint; token: string; to: string } | null = null;
let lastHandle: any = null;

// Constants
const L1_SEPOLIA = 11155111;
const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum Mainnet',
  11155111: 'Sepolia',
};

type CardContent = {
  header?: string;
  summary?: Record<string, unknown>;
  raw?: unknown;
  error?: string;
};

const formatSummaryValue = (value: unknown): string => {
  if (value == null) return '—';
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') return Number.isFinite(value) ? value.toString() : '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
};

const shortHash = (value?: string | null) => {
  if (!value) return '—';
  return value.length > 14 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
};

const formatEthAmount = (wei?: bigint | null) => {
  if (wei == null) return '—';
  try {
    return `${formatEther(wei)} ETH`;
  } catch {
    return wei.toString();
  }
};

const cardPlaceholder = (id: CardId, message: string) => {
  renderCard(id, { header: CARD_TITLES[id], summary: { Status: message } });
};

const cardLoading = (id: CardId, message: string) => {
  renderCard(id, { header: CARD_TITLES[id], summary: { Status: message } });
};

const cardError = (id: CardId, header: string, err: unknown) => {
  const message = (err as any)?.message ?? String(err);
  console.error(err);
  renderCard(id, { header, error: message, raw: err });
};

function renderCard(id: CardId, content: CardContent) {
  const node = document.getElementById(id);
  if (!node) return;

  const header = content.header ?? CARD_TITLES[id];
  const summaryEntries = content.summary ? Object.entries(content.summary) : [];
  const hasSummary = summaryEntries.length > 0;
  const raw = content.raw;
  const error = content.error;

  node.classList.toggle('error', Boolean(error));

  const summaryHtml = error
    ? `<p class="error-text">${escapeHtml(error)}</p>`
    : hasSummary
      ? `<div class="summary-list">${summaryEntries
          .map(([key, value]) => {
            const v = formatSummaryValue(value);
            return `<div class="summary-item"><span class="summary-label">${escapeHtml(key)}</span><span class="summary-value">${escapeHtml(v)}</span></div>`;
          })
          .join('')}</div>`
      : `<p class="placeholder">Awaiting data…</p>`;

  const detailsHtml =
    raw !== undefined
      ? `<details><summary>Raw JSON</summary><pre>${escapeHtml(stringify(raw))}</pre></details>`
      : '';

  const statusTag = error ? '<span class="card-status">Error</span>' : '';

  node.innerHTML = `<div class="card-header"><span class="card-title">${escapeHtml(header)}</span>${statusTag}</div>${summaryHtml}${detailsHtml}`;
}

function initCards() {
  cardPlaceholder('card-quote', 'Awaiting action');
  cardPlaceholder('card-prepare', 'Awaiting action');
  cardPlaceholder('card-create', 'Awaiting action');
  cardPlaceholder('card-status', 'No status yet');
  cardPlaceholder('card-wait', 'Not started');
}

function bindCopyButtons(container: HTMLElement) {
  container.querySelectorAll<HTMLButtonElement>('.copy-btn').forEach((btn) => {
    btn.onclick = async () => {
      const value = btn.dataset.copy ?? '';
      if (!value) return;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(value);
        } else {
          const textarea = document.createElement('textarea');
          textarea.value = value;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        }
        const original = btn.textContent ?? 'Copy';
        btn.textContent = 'Copied';
        setTimeout(() => {
          btn.textContent = original;
        }, 1500);
      } catch (copyErr) {
        console.error('Copy failed', copyErr);
      }
    };
  });
}

function updateCreateMeta(handle: any | null) {
  if (!createMeta) return;
  if (!handle) {
    createMeta.innerHTML = '';
    return;
  }
  const lines: string[] = [];
  if (handle.l1TxHash) {
    const hash = String(handle.l1TxHash);
    lines.push(
      `<div class="meta-line">L1 Tx:&nbsp;<span>${escapeHtml(hash)}</span><button class="copy-btn" data-copy="${escapeHtml(hash)}">Copy</button></div>`,
    );
  }
  const opId = (handle as any)?.operationId ?? (handle as any)?.operationID ?? null;
  if (opId) {
    const idStr = String(opId);
    lines.push(
      `<div class="meta-line">Operation ID:&nbsp;<span>${escapeHtml(idStr)}</span><button class="copy-btn" data-copy="${escapeHtml(idStr)}">Copy</button></div>`,
    );
  }
  createMeta.innerHTML = lines.join('') || '';
  bindCopyButtons(createMeta);
}

// Helpers
async function buildDepositParams() {
  if (!signer) throw new Error('Connect first.');
  const recipient = to.value.trim() || (await signer.getAddress());
  const rawAmount = amount.value.trim() || DEFAULT_DEPOSIT_AMOUNT;
  let parsed: bigint;
  try {
    parsed = parseEther(rawAmount);
  } catch {
    throw new Error(`Invalid amount: "${rawAmount}"`);
  }
  const params = { amount: parsed, token: ETH_ADDRESS, to: recipient };
  lastParams = params;
  return params;
}

async function ensureOnSepolia() {
  const hex = await l1Provider!.send('eth_chainId', []);
  const current = parseInt(hex, 16);
  if (current !== L1_SEPOLIA) {
    try {
      await l1Provider!.send('wallet_switchEthereumChain', [{ chainId: `0x${L1_SEPOLIA.toString(16)}` }]);
    } catch (err: any) {
      if (err?.code === 4902) {
        await l1Provider!.send('wallet_addEthereumChain', [
          {
            chainId: `0x${L1_SEPOLIA.toString(16)}`,
            chainName: 'Sepolia',
            nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['https://sepolia.gateway.tenderly.co', 'https://ethereum-sepolia.publicnode.com'],
            blockExplorerUrls: ['https://sepolia.etherscan.io'],
          },
        ]);
      } else {
        throw new Error('Please switch your wallet to L1 Sepolia (chainId 11155111) and try again.');
      }
    }
  }
}

const chainName = (idNum: number) => CHAIN_NAMES[idNum] ?? `Chain ${idNum}`;

function renderRoute(fromChainIdHex: string | number, toRpcUrl: string) {
  const fromId = typeof fromChainIdHex === 'string' ? parseInt(fromChainIdHex, 16) : fromChainIdHex;
  const from = `From: ${chainName(fromId)} (Injected Wallet, chainId ${fromId})`;
  const toTxt = `To: zkSync L2 (RPC: ${toRpcUrl || '—'})`;
  setTxt(net, `${from} → ${toTxt}`);
}

async function rebuildSdk() {
  if (!l1Provider || !l2Provider || !signer) return;
  const client = await createEthersClient({ l1: l1Provider, l2: l2Provider, signer });
  sdk = createEthersSdk(client);
}

function isIframe() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

initCards();
updateCreateMeta(null);

// Events
btnConnect.onclick = async () => {
  try {
    if (!window.ethereum) {
      alert('No wallet found (window.ethereum). Open in a window with MetaMask.');
      return;
    }

    if (isIframe()) {
      renderCard('card-status', {
        header: CARD_TITLES['card-status'],
        summary: { Notice: 'If wallet popups are blocked, open the demo in a new window.' },
      });
    }

    await window.ethereum.request?.({ method: 'eth_requestAccounts' });

    l1Provider = new BrowserProvider(window.ethereum);
    signer = await l1Provider.getSigner();

    await ensureOnSepolia();

    const addr = await signer.getAddress();
    setTxt(acct, addr);
    to.value = addr;

    const cidHex = await l1Provider.send('eth_chainId', []);
    const l2Url = l2Rpc.value.trim();
    l2Provider = new JsonRpcProvider(l2Url);

    renderRoute(cidHex, l2Url);

    await rebuildSdk();
    cardPlaceholder('card-status', 'Ready to query status');
  } catch (e) {
    console.error(e);
    alert((e as any)?.message ?? String(e));
  }
};

l2Rpc.oninput = async () => {
  if (l1Provider) {
    const cidHex = await l1Provider.send('eth_chainId', []);
    renderRoute(cidHex, l2Rpc.value.trim());
    l2Provider = new JsonRpcProvider(l2Rpc.value.trim());
    await rebuildSdk();
  }
};

btnQuote.onclick = async () => {
  if (!sdk) return alert('Connect first.');
  cardLoading('card-quote', 'Fetching quote…');
  try {
    await ensureOnSepolia();
    const params = await buildDepositParams();
    const result = await sdk.deposits.tryQuote(params);
    if (!result.ok) throw result.error;
    const quote = result.value;
    renderCard('card-quote', {
      header: CARD_TITLES['card-quote'],
      summary: {
        Route: quote.route,
        'Mint Value': formatEthAmount(quote.mintValue),
      },
      raw: quote,
    });
  } catch (err) {
    cardError('card-quote', CARD_TITLES['card-quote'], err);
  }
};

btnPrepare.onclick = async () => {
  if (!sdk) return alert('Connect first.');
  cardLoading('card-prepare', 'Building plan…');
  try {
    await ensureOnSepolia();
    const params = await buildDepositParams();
    const result = await sdk.deposits.tryPrepare(params);
    if (!result.ok) throw result.error;
    const plan = result.value;
    renderCard('card-prepare', {
      header: CARD_TITLES['card-prepare'],
      summary: {
        Route: plan.summary.route,
        Steps: plan.steps.length,
      },
      raw: plan,
    });
  } catch (err) {
    cardError('card-prepare', CARD_TITLES['card-prepare'], err);
  }
};

btnCreate.onclick = async () => {
  if (!sdk) return alert('Connect first.');
  cardLoading('card-create', 'Sending deposit…');
  try {
    await ensureOnSepolia();
    const params = lastParams ?? (await buildDepositParams());
    const result = await sdk.deposits.tryCreate(params);
    if (!result.ok) throw result.error;
    const handle = result.value;
    lastHandle = handle;
    if (handle?.l1TxHash) {
      opid.value = handle.l1TxHash;
    }
    updateCreateMeta(handle);
    renderCard('card-create', {
      header: CARD_TITLES['card-create'],
      summary: {
        Route: handle?.plan?.summary?.route ?? '—',
        'L1 Tx': shortHash(handle?.l1TxHash),
      },
      raw: handle,
    });
  } catch (err) {
    cardError('card-create', CARD_TITLES['card-create'], err);
    updateCreateMeta(null);
  }
};

btnStatus.onclick = async () => {
  if (!sdk) return alert('Connect first.');
  const waitable = opid.value.trim() || lastHandle;
  if (!waitable) {
    alert('Enter an L1 transaction hash or create a deposit first.');
    return;
  }
  cardLoading('card-status', 'Checking status…');
  try {
    const status = await sdk.deposits.status(waitable);
    renderCard('card-status', {
      header: CARD_TITLES['card-status'],
      summary: {
        Phase: status.phase,
        'L2 Tx': shortHash(status.l2TxHash),
      },
      raw: status,
    });
  } catch (err) {
    cardError('card-status', CARD_TITLES['card-status'], err);
  }
};

btnWait.onclick = async () => {
  if (!sdk) return alert('Connect first.');
  const waitable = opid.value.trim() || lastHandle;
  if (!waitable) {
    alert('Enter an L1 transaction hash or create a deposit first.');
    return;
  }
  cardLoading('card-wait', 'Waiting for L2 finalization…');
  try {
    const result = await sdk.deposits.tryWait(waitable, { for: 'l2' });
    if (!result.ok) throw result.error;
    const receipt = result.value;
    renderCard('card-wait', {
      header: CARD_TITLES['card-wait'],
      summary: {
        Status: receipt?.status === 1 ? 'Executed' : 'Failed',
        Block: receipt?.blockNumber ?? '—',
      },
      raw: receipt,
    });
  } catch (err) {
    cardError('card-wait', CARD_TITLES['card-wait'], err);
  }
};
