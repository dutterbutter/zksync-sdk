import { describe, it, expect } from 'bun:test';
import { pickWithdrawRoute } from '../route';
import {
  LEGACY_ETH_ADDRESS,
  ETH_ADDRESS_IN_CONTRACTS,
  L2_BASE_TOKEN_ADDRESS,
} from '../../constants';

describe('withdrawals/pickWithdrawRoute', () => {
  it("returns 'eth' for ETH token aliases", () => {
    expect(pickWithdrawRoute(LEGACY_ETH_ADDRESS)).toBe('eth');
    expect(pickWithdrawRoute(L2_BASE_TOKEN_ADDRESS)).toBe('eth');
    expect(pickWithdrawRoute(ETH_ADDRESS_IN_CONTRACTS)).toBe('eth');
    // case-insensitive
    expect(pickWithdrawRoute(LEGACY_ETH_ADDRESS.toLowerCase() as `0x${string}`)).toBe('eth');
  });

  it("returns 'erc20' for non-ETH tokens", () => {
    expect(pickWithdrawRoute('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBe('erc20');
  });
});
