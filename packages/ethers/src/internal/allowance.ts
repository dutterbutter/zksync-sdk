/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Contract } from 'ethers';
import type { Signer } from 'ethers';
import { ERC20Abi } from '@zksync-sdk/core/abis/ERC20';

export interface PermitEIP2612 {
  /** UNIX-seconds deadline (0 => unlimited) */
  deadline: number;
  /** v,r,s produced by the wallet */
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
}

type Hex = `0x${string}`;

/**
 * Makes sure `signer` has at least `amount` allowance towards `ntvAddr`.
 * – If a Permit struct is supplied, tries it first.
 * – Otherwise calls `approve` for <2 × amount> (so the next transfer is free).
 *
 * Throws **plain** `Error` — the high-level action converts it to `InteropError`.
 */
export async function ensureAllowance(
  signer: Signer,
  token: Hex,
  ntvAddr: Hex,
  amount: bigint,
): Promise<void> {
  const erc20 = new Contract(token, ERC20Abi, signer);

  /* ------------------------------------------------------------------ fast-path */
  const owner = await signer.getAddress(); // obtain address from signer
  const current = (await erc20.allowance(owner, ntvAddr)) as bigint; // cast to bigint
  if (current >= amount) return;

  // TODO: consider adding permit support

  /* ------------------------------------------------------------------ approve */
  const newAllowance = amount * 2n;
  // TODO: resolve this eslint
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const tx = await erc20.approve(ntvAddr, newAllowance);
  await tx.wait();
}
