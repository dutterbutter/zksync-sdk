import { describe, it, expect } from 'bun:test';
import { Interface } from 'ethers';
import { createEthersClient, type EthersClient } from '../client';
import IBridgehubABI from '../../../internal/abis/IBridgehub.json';
import IL1AssetRouterABI from '../../../internal/abis/IL1AssetRouter.json';
import IL1NullifierABI from '../../../internal/abis/IL1Nullifier.json';
import {
  L2_ASSET_ROUTER_ADDR,
  L2_NATIVE_TOKEN_VAULT_ADDR,
  L2_BASE_TOKEN_ADDRESS,
} from '../../../core/constants';

// ---------- tiny helpers ----------

const IBridgehub = new Interface(IBridgehubABI as any);
const IL1AssetRouter = new Interface(IL1AssetRouterABI as any);
const IL1Nullifier = new Interface(IL1NullifierABI as any);

type CallTx = { to?: string; data?: string };

function hexLower(s: string) {
  return (s || '').toLowerCase();
}

function makeFakeL1Provider(mapping: {
  // (to, 4-byte selector) -> encoded return data
  [key: string]: string;
}) {
  return {
    async call(tx: CallTx) {
      const to = hexLower(tx.to || '');
      const sel = (tx.data || '').slice(0, 10).toLowerCase();
      const key = `${to}|${sel}`;
      const out = mapping[key];
      if (!out) {
        throw new Error(`no fake mapping for ${key}`);
      }
      return out;
    },
  } as any;
}

function makeFakeL2Provider(bridgehubAddr: string) {
  return {
    async send(method: string, _params: any[]) {
      if (method === 'zks_getBridgehubContract') return bridgehubAddr;
      throw new Error(`unexpected method: ${method}`);
    },
  } as any;
}

function makeFakeSigner() {
  return {
    provider: undefined as any,
    connect(p: any) {
      return { ...this, provider: p };
    },
    async getAddress() {
      return '0x' + '11'.repeat(20);
    },
  } as any;
}

// ---------- fixture addresses we’ll return from our fakes ----------
const ADDR = {
  bridgehub: '0xB000000000000000000000000000000000000000',
  l1AssetRouter: '0xA000000000000000000000000000000000000000',
  l1Nullifier: '0xC000000000000000000000000000000000000000',
  l1NativeTokenVault: '0xD000000000000000000000000000000000000000',
  baseTokenFor324: '0xBee0000000000000000000000000000000000000',
};

function mappingForL1Calls() {
  // Encode return payloads that ethers.Contract will decode
  const map: Record<string, string> = {};

  // Bridgehub.assetRouter() -> l1AssetRouter
  {
    const to = hexLower(ADDR.bridgehub);
    const sel = IBridgehub.getFunction('assetRouter')!.selector.toLowerCase();
    const key = `${to}|${sel}`;
    map[key] = IBridgehub.encodeFunctionResult('assetRouter', [ADDR.l1AssetRouter]);
  }

  // Bridgehub.baseToken(uint256) -> base token address for chain 324
  {
    const to = hexLower(ADDR.bridgehub);
    const sel = IBridgehub.getFunction('baseToken')!.selector.toLowerCase();
    const key = `${to}|${sel}`;
    // Contract will pass the encoded args in data; our fake matches on selector only
    map[key] = IBridgehub.encodeFunctionResult('baseToken', [ADDR.baseTokenFor324]);
  }

  // L1AssetRouter.L1_NULLIFIER() -> l1Nullifier
  {
    const to = hexLower(ADDR.l1AssetRouter);
    const sel = IL1AssetRouter.getFunction('L1_NULLIFIER')!.selector.toLowerCase();
    const key = `${to}|${sel}`;
    map[key] = IL1AssetRouter.encodeFunctionResult('L1_NULLIFIER', [ADDR.l1Nullifier]);
  }

  // L1Nullifier.l1NativeTokenVault() -> l1NativeTokenVault
  {
    const to = hexLower(ADDR.l1Nullifier);
    const sel = IL1Nullifier.getFunction('l1NativeTokenVault')!.selector.toLowerCase();
    const key = `${to}|${sel}`;
    map[key] = IL1Nullifier.encodeFunctionResult('l1NativeTokenVault', [ADDR.l1NativeTokenVault]);
  }

  return map;
}

// ---------- tests ----------

describe('adapters/ethers/createEthersClient', () => {
  it('binds signer to L1 provider and resolves/caches addresses via ensureAddresses()', async () => {
    const l1 = makeFakeL1Provider(mappingForL1Calls());
    const l2 = makeFakeL2Provider(ADDR.bridgehub);
    const signer = makeFakeSigner();

    const client = createEthersClient({ l1, l2, signer });
    // signer was auto-connected to l1
    expect((client.signer as any).provider).toBe(l1);

    const resolved = await client.ensureAddresses();
    expect(resolved.bridgehub.toLowerCase()).toBe(ADDR.bridgehub.toLowerCase());
    expect(resolved.l1AssetRouter.toLowerCase()).toBe(ADDR.l1AssetRouter.toLowerCase());
    expect(resolved.l1Nullifier.toLowerCase()).toBe(ADDR.l1Nullifier.toLowerCase());
    expect(resolved.l1NativeTokenVault.toLowerCase()).toBe(ADDR.l1NativeTokenVault.toLowerCase());
    // L2 constants are passed through
    expect(resolved.l2AssetRouter.toLowerCase()).toBe(L2_ASSET_ROUTER_ADDR.toLowerCase());
    expect(resolved.l2NativeTokenVault.toLowerCase()).toBe(
      L2_NATIVE_TOKEN_VAULT_ADDR.toLowerCase(),
    );
    expect(resolved.l2BaseTokenSystem.toLowerCase()).toBe(L2_BASE_TOKEN_ADDRESS.toLowerCase());

    // cached: second call returns same object reference
    const again = await client.ensureAddresses();
    expect(again).toBe(resolved);
  });

  it('contracts(): returns connected Contracts and caches until refresh()', async () => {
    const l1 = makeFakeL1Provider(mappingForL1Calls());
    const l2 = makeFakeL2Provider(ADDR.bridgehub);
    const signer = makeFakeSigner();
    const client = createEthersClient({ l1, l2, signer });

    const a = await client.ensureAddresses();
    const c1 = await client.contracts();

    // Sanity: targets match addresses we resolved
    expect((c1.bridgehub as any).target.toLowerCase()).toBe(a.bridgehub.toLowerCase());
    expect((c1.l1AssetRouter as any).target.toLowerCase()).toBe(a.l1AssetRouter.toLowerCase());
    expect((c1.l1Nullifier as any).target.toLowerCase()).toBe(a.l1Nullifier.toLowerCase());
    expect((c1.l1NativeTokenVault as any).target.toLowerCase()).toBe(
      a.l1NativeTokenVault.toLowerCase(),
    );
    expect((c1.l2AssetRouter as any).target.toLowerCase()).toBe(a.l2AssetRouter.toLowerCase());
    expect((c1.l2NativeTokenVault as any).target.toLowerCase()).toBe(
      a.l2NativeTokenVault.toLowerCase(),
    );
    expect((c1.l2BaseTokenSystem as any).target.toLowerCase()).toBe(
      a.l2BaseTokenSystem.toLowerCase(),
    );

    // caching
    const c2 = await client.contracts();
    expect(c2).toBe(c1);

    // refresh invalidates caches; new object after refresh
    client.refresh();
    const c3 = await client.contracts();
    expect(c3).not.toBe(c1);
  });

  it('baseToken(chainId): queries Bridgehub and returns address', async () => {
    const l1 = makeFakeL1Provider(mappingForL1Calls());
    const l2 = makeFakeL2Provider(ADDR.bridgehub);
    const signer = makeFakeSigner();
    const client = createEthersClient({ l1, l2, signer });

    const addr = await client.baseToken(324n);
    expect(addr.toLowerCase()).toBe(ADDR.baseTokenFor324.toLowerCase());
  });

  it('respects manual overrides (skips zks + calls)', async () => {
    const l1 = makeFakeL1Provider({}); // no mappings needed when all overridden
    const l2 = makeFakeL2Provider('0xdead'); // should be ignored
    const signer = makeFakeSigner();

    const overrides = {
      bridgehub: '0x1000000000000000000000000000000000000001',
      l1AssetRouter: '0x2000000000000000000000000000000000000002',
      l1Nullifier: '0x3000000000000000000000000000000000000003',
      l1NativeTokenVault: '0x4000000000000000000000000000000000000004',
      l2AssetRouter: '0x5000000000000000000000000000000000000005',
      l2NativeTokenVault: '0x6000000000000000000000000000000000000006',
      l2BaseTokenSystem: '0x7000000000000000000000000000000000000007',
    } as const;

    const client: EthersClient = createEthersClient({ l1, l2, signer, overrides });
    const a = await client.ensureAddresses();

    expect(a).toMatchObject(overrides);
  });
});
