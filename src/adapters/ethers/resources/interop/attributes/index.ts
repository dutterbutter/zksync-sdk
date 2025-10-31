// adapters/ethers/resources/interop/attributes/index.ts
import { AttributesCodecCore } from './internal';
import { CallAttributesEncoder } from './call';
import { BundleAttributesEncoder } from './bundle';
import { AttributesDecoder } from './decoder';

const core = new AttributesCodecCore();

/**
 * Encoders (call-level and bundle-level),
 */
export const callAttributesEncoder = new CallAttributesEncoder(core);
export const bundleAttributesEncoder = new BundleAttributesEncoder(core);

/**
 * Decoder for status(), debug, devtools.
 */
export const attributesDecoder = new AttributesDecoder(core);
