// adapters/ethers/resources/interop/attributes/call.ts
import type { Hex } from '../../../../../core/types/primitives';
import { AttributesCodecCore } from './internal';

/**
 * Encodes per-call attributes (apply to one InteropCallStarter).
 */
export class CallAttributesEncoder {
  private readonly core: AttributesCodecCore;

  constructor(core?: AttributesCodecCore) {
    this.core = core ?? new AttributesCodecCore();
  }

  /**
   * indirectCall(uint256 messageValue)
   *
   * Meaning:
   * - This call should NOT be executed directly on the destination contract.
   * - Instead, InteropCenter should call L2AssetRouter.initiateIndirectCall(...)
   *   on the source, funding it with `messageValue`.
   * - That router will burn/lock funds and return a remote "finalizeDeposit"
   *   payload targeted at the destination router.
   */
  indirectCall(messageValue: bigint): Hex {
    return this.core.encode('indirectCall', [messageValue]);
  }

  /**
   * interopCallValue(uint256 bridgedAmount)
   *
   * Meaning:
   * - The callee on the destination chain MUST observe that this much value
   *   is being credited/forwarded.
   * - Used by L2AssetRouter on the destination side to enforce that the
   *   finalizeDeposit payload matches the value that was actually bridged.
   */
  interopCallValue(bridgedAmount: bigint): Hex {
    return this.core.encode('interopCallValue', [bridgedAmount]);
  }

  /**
   * Convenience: build the standard attribute set for a native asset bridge call.
   *
   * messageValue = how much native asset we send *right now on source* into the router
   * bridgedAmount = how much value should appear / be claimable on destination
   *
   * In the standard case these are equal, but they are conceptually distinct:
   * - messageValue funds the burn on source.
   * - bridgedAmount enforces settlement / mint on dest.
   */
  nativeBridge(messageValue: bigint, bridgedAmount: bigint): Hex[] {
    return [this.indirectCall(messageValue), this.interopCallValue(bridgedAmount)];
  }
}
