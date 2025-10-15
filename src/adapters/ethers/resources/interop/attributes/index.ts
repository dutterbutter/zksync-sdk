// adapters/ethers/resources/interop/attributes/index.ts
import { Interface } from 'ethers';
import IERC7786AttributesAbi from '../../../../../core/internal/abis/IERC7786Attributes';
import type { Hex, Address } from '../../../../../core/types/primitives';

/**
 * Attribute encoders for ERC-7786 attributes.
 */
export class AttributesEncoder {
  private readonly iface: Interface;

  constructor(iface?: Interface) {
    // Allow passing a shared Interface from context to avoid re-allocations.
    this.iface = iface ?? new Interface(IERC7786AttributesAbi);
  }

  /** interopCallValue(uint256) — per-call msg.value on the destination */
  interopCallValue(amount: bigint): Hex {
    return this.iface.encodeFunctionData('interopCallValue', [amount]) as Hex;
  }

  /**
   * indirectCall(uint256 messageValue) — route via Asset Router (bridge hop),
   * indicating how much value should be carried with the indirect message.
   */
  indirectCall(messageValue: bigint): Hex {
    return this.iface.encodeFunctionData('indirectCall', [messageValue]) as Hex;
  }

  /** executionAddress(address) — restrict who can execute the bundle on destination */
  executionAddress(addr: Address): Hex {
    return this.iface.encodeFunctionData('executionAddress', [addr]) as Hex;
  }

  /** unbundlerAddress(address) — allow this address to selectively execute/cancel calls */
  unbundlerAddress(addr: Address): Hex {
    return this.iface.encodeFunctionData('unbundlerAddress', [addr]) as Hex;
  }
}

/** Convenience singleton */
export const attributes = new AttributesEncoder();
