// adapters/ethers/resources/interop/attributes/decoder.ts
import type {
  EncodedCallAttributes,
  EncodedBundleAttributes,
  DecodedAttribute,
  DecodedAttributesSummary,
} from '../../../../../core/types/flows/interop';
import { AttributesCodecCore } from './internal';

export class AttributesDecoder {
  private readonly core: AttributesCodecCore;

  constructor(core?: AttributesCodecCore) {
    this.core = core ?? new AttributesCodecCore();
  }

  /**
   * Decode an array of encoded call attributes (Hex[]) into structured info.
   * Safe even if there are unknown attributes.
   */
  decodeCallAttributes(attrs: EncodedCallAttributes): DecodedAttribute[] {
    return attrs.map((a) => this.core.decode(a));
  }

  /**
   * Decode an array of encoded bundle attributes (Hex[]) into structured info.
   */
  decodeBundleAttributes(attrs: EncodedBundleAttributes): DecodedAttribute[] {
    return attrs.map((a) => this.core.decode(a));
  }

  /**
   * Convenience formatter for logging / debugging status() output.
   */
  summarize(
    callAttrs: EncodedCallAttributes,
    bundleAttrs: EncodedBundleAttributes,
  ): DecodedAttributesSummary {
    return {
      call: this.decodeCallAttributes(callAttrs),
      bundle: this.decodeBundleAttributes(bundleAttrs),
    };
  }
}
