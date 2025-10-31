// adapters/ethers/resources/interop/attributes/internal.ts
import { Interface, type Result } from 'ethers';
import IERC7786AttributesAbi from '../../../../../core/internal/abis/IERC7786Attributes';
import type { Hex } from '../../../../../core/types/primitives';
import type { DecodedAttribute } from '../../../../../core/types/flows/interop';

/**
 * Thin wrapper around IERC7786Attributes ABI.
 * Provides low-level encode/decode primitives.
 */
export class AttributesCodecCore {
  public readonly iface: Interface;

  constructor(iface?: Interface) {
    // We assume IERC7786AttributesAbi contains ONLY attribute funcs or at least
    // includes them. If it's a superset ABI, that's still fine for encode/decode.
    this.iface = iface ?? new Interface(IERC7786AttributesAbi);
  }

  encode(fn: string, args: unknown[]): Hex {
    return this.iface.encodeFunctionData(fn, args) as Hex;
  }

  /**
   * Attempt to decode an encoded attribute (bytes) back into {name, args}.
   * If the selector is unknown to the ABI, we still return selector.
   */
  decode(attr: Hex): DecodedAttribute {
    const selector = attr.slice(0, 10) as Hex; // 0x + 8 hex chars

    // Look up fragment by selector
    const frag = this.iface.getFunction(selector);
    if (!frag) {
      return {
        selector,
        name: 'unknown',
        args: [attr],
      };
    }

    // Decode args
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [, dataNoSelector] = [attr.slice(0, 10), attr.slice(10)];
    // ethers.Interface doesn't decode raw hex without selector unless we trick it:
    // we'll just use decodeFunctionData and let it do the slicing for us.
    const decoded: Result = this.iface.decodeFunctionData(frag, attr);

    return {
      selector,
      name: frag.name,
      args: Array.from(decoded),
    };
  }
}
