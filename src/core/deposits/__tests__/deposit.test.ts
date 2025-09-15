import { describe, it, expect } from 'bun:test';
import { pickRouteSmart, type BaseTokenLookup } from '../route';
import {
  LEGACY_ETH_ADDRESS,
  L2_BASE_TOKEN_ADDRESS,
  ETH_ADDRESS_IN_CONTRACTS,
} from '../../constants';

// Tiny inline fake; no need for helpers yet
function fakeClient(baseTokenAddr: string): BaseTokenLookup {
  return {
    baseToken(_chainId: bigint) {
      void _chainId;
      return Promise.resolve(baseTokenAddr as `0x${string}`);
    },
  };
}

describe('deposit/pickRouteSmart', () => {
  it("returns 'eth' for any ETH alias (L1 legacy / L2 base / in-contracts)", async () => {
    const client = fakeClient('0x0000000000000000000000000000000000000000'); // irrelevant for ETH

    expect(await pickRouteSmart(client, 324n, LEGACY_ETH_ADDRESS)).toBe('eth');
    expect(await pickRouteSmart(client, 324n, L2_BASE_TOKEN_ADDRESS)).toBe('eth');
    expect(await pickRouteSmart(client, 324n, ETH_ADDRESS_IN_CONTRACTS)).toBe('eth');

    // Casing differences should still be treated as ETH (isETH uses isAddressEq)
    expect(
      await pickRouteSmart(client, 324n, LEGACY_ETH_ADDRESS.toLowerCase() as `0x${string}`),
    ).toBe('eth');
  });

  it("returns 'erc20-base' when token equals the L2 base token (case/prefix agnostic)", async () => {
    const base = '0x1111111111111111111111111111111111111111';
    const client = fakeClient(base);

    // same address, different case
    const tokenMixedCase = base.toUpperCase();
    expect(await pickRouteSmart(client, 271n, tokenMixedCase as `0x${string}`)).toBe('erc20-base');

    // same address without 0x (normalizeAddrEq handles prefix)
    const tokenNoPrefix = base.slice(2);
    expect(await pickRouteSmart(client, 271n, tokenNoPrefix as `0x${string}`)).toBe('erc20-base');
  });

  it("returns 'erc20-nonbase' when token differs from L2 base token", async () => {
    const client = fakeClient('0x2222222222222222222222222222222222222222');
    const token = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    expect(await pickRouteSmart(client, 506n, token as `0x${string}`)).toBe('erc20-nonbase');
  });

  it('propagates errors thrown by client.baseToken (no wrapping here by design)', () => {
    const client: BaseTokenLookup = {
      baseToken() {
        return Promise.reject(new Error('network down'));
      },
    };
    return expect(
      pickRouteSmart(client, 999n, '0x3333333333333333333333333333333333333333' as `0x${string}`),
    ).rejects.toThrow(/network down/);
  });
});
