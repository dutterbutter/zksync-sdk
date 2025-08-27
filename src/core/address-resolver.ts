import type { CoreContext } from './context';
import type { Address } from '../types/primitives';

export class AddressResolver {
  constructor(private ctx: CoreContext) {}

  l1Bridgehub(chainKey: string | number): Address {
    const addr = this.ctx.resolveChain(chainKey).addresses.l1?.bridgehub;
    if (!addr) {
      throw new Error(`l1.bridgehub address not configured for chain ${chainKey}`);
    }
    return addr;
  }
  l1AssetRouter(chainKey: string | number): Address {
    const addr = this.ctx.resolveChain(chainKey).addresses.l1?.assetRouter;
    if (!addr) {
      throw new Error(`l1.assetRouter address not configured for chain ${chainKey}`);
    }
    return addr;
  }
  l1NativeTokenVault(chainKey: string | number): Address {
    const addr = this.ctx.resolveChain(chainKey).addresses.l1?.nativeTokenVault;
    if (!addr) {
      throw new Error(`l1.nativeTokenVault address not configured for chain ${chainKey}`);
    }
    return addr;
  }

  l2InteropCenter(chainKey: string | number): Address {
    return this.ctx.resolveChain(chainKey).addresses.l2.interopCenter;
  }
  l2Handler(chainKey: string | number): Address {
    return this.ctx.resolveChain(chainKey).addresses.l2.handler;
  }
  l2AssetRouter(chainKey: string | number): Address {
    const addr = this.ctx.resolveChain(chainKey).addresses.l2.assetRouter;
    if (!addr) {
      throw new Error(`l2.assetRouter address not configured for chain ${chainKey}`);
    }
    return addr;
  }
  l2NativeTokenVault(chainKey: string | number): Address {
    const addr = this.ctx.resolveChain(chainKey).addresses.l2.nativeTokenVault;
    if (!addr) {
      throw new Error(`l2.nativeTokenVault address not configured for chain ${chainKey}`);
    }
    return addr;
  }
}
