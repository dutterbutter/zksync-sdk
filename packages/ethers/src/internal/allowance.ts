// packages/ethers/src/internal/allowance.ts
import type { Signer } from 'ethers';
import { Contract } from 'ethers';
import { ERC20Abi } from '@zksync-sdk/core/abis/ERC20';
import type { Hex } from '@zksync-sdk/core';

// TODO: import ERC20 interface
interface ERC20Like {
  allowance(owner: string, spender: string): Promise<bigint>;
  approve(spender: string, amount: bigint): Promise<{ wait(): Promise<unknown> }>;
}

export async function ensureAllowance(
  signer: Signer,
  token: Hex,
  ntvAddr: Hex,
  amount: bigint,
): Promise<void> {
  const owner = await signer.getAddress();

  const erc20 = new Contract(token, ERC20Abi, signer) as unknown as ERC20Like;

  const current = await erc20.allowance(owner, ntvAddr);
  if (current >= amount) return;

  // (permit to be added later)
  const tx = await erc20.approve(ntvAddr, amount * 2n);
  await tx.wait();
}
