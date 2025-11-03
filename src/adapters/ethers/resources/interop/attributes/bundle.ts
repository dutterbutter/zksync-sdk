// adapters/ethers/resources/interop/attributes/bundle.ts
import type { Address, Hex } from '../../../../../core/types/primitives';
import { AttributesCodecCore } from './internal';

/**
 * Encodes bundle-level attributes (apply to the whole InteropBundle).
 */
export class BundleAttributesEncoder {
  private readonly core: AttributesCodecCore;

  constructor(core?: AttributesCodecCore) {
    this.core = core ?? new AttributesCodecCore();
  }

  /**
   * executionAddress(address executor)
   *
   * Meaning:
   * - Only this address on the destination chain is allowed to
   *   call InteropHandler.executeBundle(...) for this bundle.
   * - If omitted, execution is permissionless.
   */
  executionAddress(executor: Address): Hex {
    return this.core.encode('executionAddress', [executor]);
  }

  /**
   * unbundlerAddress(address addr)
   *
   * Meaning:
   * - This address can "unbundle" or partially execute / cancel calls
   *   within the bundle, depending on how the destination handler enforces
   *   unbundling semantics.
   * - Optional. Most simple native transfers won't need this.
   */
  unbundlerAddress(addr: Address): Hex {
    return this.core.encode('unbundlerAddress', [addr]);
  }
}
