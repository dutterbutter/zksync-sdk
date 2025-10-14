// src/adapters/ethers/resources/interop/types.ts
import type { AbstractProvider, Signer, Interface } from 'ethers';
import type { Address } from '../../../../core/types/primitives';
import type { InteropTopics } from '../../../../core/resources/interop/events';
import type { ResolvedAddresses } from '../../client';

// + l2AssetRouter included
export type InteropAddresses = Pick<
  ResolvedAddresses,
  'interopCenter' | 'interopHandler' | 'bridgehub' | 'l2AssetRouter'
>;

export type InteropBaseTokens = {
  src: Address;
  dst: Address;
};

export type InteropEthersContext = {
  srcProvider: AbstractProvider;
  dstProvider: AbstractProvider;
  signer: Signer;

  srcChainId: bigint;
  dstChainId: bigint;

  addresses: InteropAddresses;
  baseTokens: InteropBaseTokens;

  ifaces: {
    attributes: Interface;
    interopCenter: Interface;
    interopHandler: Interface;
  };
  topics: InteropTopics;
};
