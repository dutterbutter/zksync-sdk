import { BrowserProvider, parseEther } from 'ethers';
// Adjust this to your SDK's actual browser-friendly entry:
import { createEthersClient, createEthersSdk } from '@dutterbutter/zksync-sdk/ethers';

declare global {
  interface Window { ethereum?: any }
}

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const log = (x: any) => { out.textContent += `${typeof x === 'string' ? x : JSON.stringify(x, null, 2)}\n`; out.scrollTop = out.scrollHeight; }
const setTxt = (node: HTMLElement, txt: string) => node.textContent = txt;

const btnConnect = el<HTMLButtonElement>('connect');
const acct = el<HTMLDivElement>('acct');
const net = el<HTMLDivElement>('net');
const out = el<HTMLPreElement>('log');

const l2Rpc = el<HTMLInputElement>('l2Rpc');
const amount = el<HTMLInputElement>('amount');
const to = el<HTMLInputElement>('to');
const opid = el<HTMLInputElement>('opid');

const btnQuote = el<HTMLButtonElement>('btn-quote');
const btnPrepare = el<HTMLButtonElement>('btn-prepare');
const btnCreate = el<HTMLButtonElement>('btn-create');
const btnStatus = el<HTMLButtonElement>('btn-status');
const btnWait = el<HTMLButtonElement>('btn-wait');

let provider: BrowserProvider | null = null;
let signer: any = null;
let zks: any = null;

let lastQuote: any = null;
let lastPrepared: any = null;
let lastCreated: any = null;

const SEPOLIA_CHAIN_ID = 11155111;

async function ensureNetwork(chainId: number) {
  const cur = await provider!.send('eth_chainId', []);
  const curNum = Number(cur);
  if (curNum !== chainId) {
    try {
      await provider!.send('wallet_switchEthereumChain', [{ chainId: `0x${chainId.toString(16)}` }]);
    } catch (e) {
      throw new Error(`Please switch to chainId=${chainId} in your wallet.`);
    }
  }
}

btnConnect.onclick = async () => {
  if (!window.ethereum) {
    alert('No wallet found (window.ethereum). Open in a window with MetaMask.');
    return;
  }
  provider = new BrowserProvider(window.ethereum);
  const accounts = await provider.send('eth_requestAccounts', []);
  signer = await provider.getSigner();
  const addr = await signer.getAddress();
  setTxt(acct, `Connected: ${addr}`);
  const cid = await provider.send('eth_chainId', []);
  setTxt(net, `ChainId: ${parseInt(cid, 16)}`);

  // init SDK
  const l2Url = l2Rpc.value.trim();
  const l2Web = new BrowserProvider(new (class {
    // minimal transport proxy to hit HTTP RPC (ethers BrowserProvider expects EIP-1193; we can skip and let SDK use fetch internally if supported)
  }) as any);
  
  zks = await createEthersClient({
    l1Provider,   // injected L1
    l2Provider: l2Url,        // let adapter build its own public client/provider for L2
    signer,
  });
  const sdk = await createEthersSdk(zks);

  log('SDK ready.');
};

btnQuote.onclick = async () => {
  if (!zks) return alert('Connect first.');
  await ensureNetwork(SEPOLIA_CHAIN_ID);
  const a = to.value.trim() || await signer.getAddress();
  const amt = parseEther(amount.value || '0.01');

  lastQuote = await zks.deposit.quote({ asset: 'ETH', amount: amt, to: a });
  log({ quote: lastQuote });
};

btnPrepare.onclick = async () => {
  if (!zks || !lastQuote) return alert('Get a Quote first.');
  const a = to.value.trim() || await signer.getAddress();
  const amt = parseEther(amount.value || '0.01');

  lastPrepared = await zks.deposit.prepare({ asset: 'ETH', amount: amt, to: a, quote: lastQuote });
  log({ prepared: lastPrepared });
};

btnCreate.onclick = async () => {
  if (!zks || !lastPrepared) return alert('Prepare first.');
  lastCreated = await zks.deposit.create({ ...lastPrepared });
  opid.value = lastCreated.operationId;
  log({ created: lastCreated });
};

btnStatus.onclick = async () => {
  if (!zks || !opid.value) return alert('Enter Operation ID.');
  const s = await zks.deposit.status(opid.value);
  log({ status: s });
};

btnWait.onclick = async () => {
  if (!zks || !opid.value) return alert('Enter Operation ID.');
  const r = await zks.deposit.wait(opid.value, { target: 'finalized', pollIntervalMs: 4000, timeoutMs: 10 * 60_000 });
  log({ finalized: r });
};
