// src/adapters/ethers/client.ts
import type { AbstractProvider, ContractRunner, Signer } from 'ethers';
import { isAddress } from 'ethers';
import type { Address } from '../../types/primitives';

export interface EthersClient {
  readonly kind: 'ethers';
  /** L1 read/write provider (where Bridgehub lives) */
  readonly l1: AbstractProvider;
  /** L2 read-only provider (target ZK chain) */
  readonly l2: AbstractProvider;
  /** Signer used for sends (must be connected to L1 provider for L1 txs) */
  readonly signer: Signer;

  /** Cached resolved addresses (Bridgehub today; can expand later) */
  ensureAddresses(): Promise<{ bridgehub: Address }>;
}

type InitArgs = {
  /** L1 provider (Bridgehub is on L1) */
  l1: AbstractProvider;
  /** L2 provider (used for zks_getBridgehubContract + later L2 reads) */
  l2: AbstractProvider;
  /** Signer for sending L1 txs. Should be connected to `l1` (we’ll ensure it). */
  signer: Signer;
  /** Optional manual overrides (handy for local/dev) */
  overrides?: {
    bridgehub?: Address;
  };
};

/** Normalize & assert an address-like string into checksummed hex */
function asAddress(x: string): Address {
  if (!isAddress(x)) {
    throw new Error(`Invalid address: ${String(x)}`);
  }
  // ethers returns a checksummed string already; type-cast to our Address
  return x as Address;
}

/**
 * Ask the L2 RPC for the canonical Bridgehub for this chain.
 * The method returns an L1 address (string).
 */
async function rpcGetBridgehub(l2: AbstractProvider): Promise<Address> {
  // Some providers don't expose a typed `send` on AbstractProvider in our
  // ethers types; treat it as an RPC-capable provider and guard the result.
  const rpc = l2 as unknown as { send(method: string, params: unknown[]): Promise<unknown> };
  const raw = await rpc.send('zks_getBridgehubContract', []);
  if (typeof raw !== 'string') {
    throw new Error(`Invalid response from zks_getBridgehubContract: ${String(raw)}`);
  }
  return asAddress(raw);
}

/**
 * Create an EthersClient: a thin handle that carries providers/signer and
 * resolves the minimal addresses needed by resources.
 */
export function createEthersClient(args: InitArgs): EthersClient {
  const { l1, l2, signer } = args;

  // Ensure signer is connected to L1 provider; if not, connect it.
  let boundSigner = signer;

  if (!boundSigner.provider || (boundSigner.provider as unknown as ContractRunner) !== l1) {
    boundSigner = signer.connect(l1);
  }

  // Lazy-resolve & cache addresses
  let bridgehubCache: Address | undefined;

  async function ensureAddresses() {
    if (!bridgehubCache) {
      bridgehubCache = args.overrides?.bridgehub ?? (await rpcGetBridgehub(l2));
    }
    return { bridgehub: bridgehubCache };
  }

  const client: EthersClient = {
    kind: 'ethers',
    l1,
    l2,
    signer: boundSigner,
    ensureAddresses,
  };

  return client;
}

export type { InitArgs as EthersClientInit };
