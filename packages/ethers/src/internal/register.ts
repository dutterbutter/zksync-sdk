// packages/ethers/src/internal/register.ts
import { Contract } from 'ethers';
import type { Signer, ContractTransactionResponse } from 'ethers';
import { IL2NativeTokenVaultAbi as IL2NTV } from '@zksync-sdk/core/abis/IL2NativeTokenVault';
import type { Hex } from '@zksync-sdk/core';

interface IL2NTVContract {
  assetId(token: Hex): Promise<string>;
  ensureTokenIsRegistered(token: Hex): Promise<ContractTransactionResponse>;
}

/** Idempotent: registers the token in NTV if missing. */
export async function ensureRegisteredInNTV(
  signer: Signer,
  ntvAddr: Hex,
  token: Hex,
): Promise<void> {
  const ntv = new Contract(ntvAddr, IL2NTV, signer) as unknown as IL2NTVContract;

  // Fast path: if public mapping getter exists & returns non-zero, skip write
  try {
    const id: string = await ntv.assetId(token);
    if (id && id !== '0x' + '00'.repeat(32)) return;
  } catch {
    // ignore
  }

  const tx = await ntv.ensureTokenIsRegistered(token);
  await tx.wait();
}
