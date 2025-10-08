// adapters/ethers/resources/interop/context.ts
import type { AbstractProvider, Signer } from 'ethers';
import { Interface } from 'ethers';

import type { Address, Hex } from '../../../../core/types/primitives';
import type { EthersClient } from '../../client';

import IERC7786AttributesAbi from '../../../../core/internal/abis/IERC7786Attributes';
import InteropCenterAbi from '../../../../core/internal/abis/InteropCenter';
import IInteropHandlerAbi from '../../../../core/internal/abis/IInteropHandler';

/** Topics we care about */
export type InteropTopics = {
  InteropBundleSent: Hex;
  BundleVerified: Hex;
  BundleExecuted: Hex;
  BundleUnbundled: Hex;
  // Optional granularity
  CallProcessed?: Hex;
};

export type InteropAddresses = {
  interopCenter: Address;  // source-side emitter
  interopHandler: Address; // destination-side emitter
  bridgehub: Address;      // handy for tooling
};

export type InteropBaseTokens = {
  src: Address; // base token on source chain
  dst: Address; // base token on destination chain
};

export type InteropEthersContext = {
  // Execution/read surfaces
  srcProvider: AbstractProvider;
  dstProvider: AbstractProvider;
  signer: Signer;

  // Chain ids
  srcChainId: bigint;
  dstChainId: bigint;

  // Addresses & base tokens
  addresses: InteropAddresses;
  baseTokens: InteropBaseTokens;

  // Cached ABIs & topics
  ifaces: {
    attributes: Interface;
    interopCenter: Interface;
    interopHandler: Interface;
  };
  topics: InteropTopics;
};

/** Build event topics directly from ABI (no hardcoded sigs) */
function buildTopics(): InteropTopics {
  // Some versions of the ethers typings don't expose `getEventTopic` on Interface,
  // so cast to a minimal shape that includes the method to keep runtime behavior
  // while satisfying TypeScript.
  const center = new Interface(InteropCenterAbi) as unknown as { getEventTopic(name: string): string };
  const handler = new Interface(IInteropHandlerAbi) as unknown as { getEventTopic(name: string): string };
  return {
    InteropBundleSent: center.getEventTopic('InteropBundleSent') as Hex,
    BundleVerified: handler.getEventTopic('BundleVerified') as Hex,
    BundleExecuted: handler.getEventTopic('BundleExecuted') as Hex,
    BundleUnbundled: handler.getEventTopic('BundleUnbundled') as Hex,
    // CallProcessed: handler.getEventTopic('CallProcessed') as Hex, // if/when present
  };
}

/** Create an interop context from the client and a destination chainId */
export async function makeInteropContext(client: EthersClient, dstChain: bigint): Promise<InteropEthersContext> {
  // Providers (source = current client.l2, destination from registry)
  const srcProvider = client.l2;
  const dstProvider = client.requireProvider(dstChain);

  // Signer bound to source (where sendCall/sendBundle is submitted)
  const signer = client.signerFor(); // defaults to current/source L2

  // Chain ids
  const [srcNet, dstNet] = await Promise.all([srcProvider.getNetwork(), dstProvider.getNetwork()]);
  const srcChainId = BigInt(srcNet.chainId.toString());
  const dstChainId = BigInt(dstNet.chainId.toString());

  // Addresses (interopCenter/handler are global; bridgehub from L1 discovery)
  const { interopCenter, interopHandler, bridgehub } = await client.ensureAddresses();
  const addresses: InteropAddresses = { interopCenter, interopHandler, bridgehub };

  // Base tokens (used for direct vs router value semantics)
  const baseTokens: InteropBaseTokens = {
    src: await client.baseToken(srcChainId),
    dst: await client.baseToken(dstChainId),
  };

  // Interfaces & topics (cached per context)
  const ifaces = {
    attributes: new Interface(IERC7786AttributesAbi),
    interopCenter: new Interface(InteropCenterAbi),
    interopHandler: new Interface(IInteropHandlerAbi),
  };
  const topics = buildTopics();

  return {
    srcProvider,
    dstProvider,
    signer,
    srcChainId,
    dstChainId,
    addresses,
    baseTokens,
    ifaces,
    topics,
  };
}
