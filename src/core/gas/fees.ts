// import { L1_FEE_ESTIMATION_COEF_NUMERATOR, L1_FEE_ESTIMATION_COEF_DENOMINATOR } from '../constants';

/**
 * Scales the provided gas limit using a coefficient to ensure acceptance of L1->L2 transactions.
 *
 * This function adjusts the gas limit by multiplying it with a coefficient calculated from the
 * `L1_FEE_ESTIMATION_COEF_NUMERATOR` and `L1_FEE_ESTIMATION_COEF_DENOMINATOR` constants.
 *
 * @param gasLimit - The gas limit to be scaled.
 *
 * @example
 *
 * import { utils } from "zksync-ethers";
 *
 * const scaledGasLimit = utils.scaleGasLimit(10_000);
 * // scaledGasLimit = 12_000
 */
// export function scaleGasLimit(gasLimit: bigint): bigint {
//   return (
//     (gasLimit * BigInt(L1_FEE_ESTIMATION_COEF_NUMERATOR)) /
//     BigInt(L1_FEE_ESTIMATION_COEF_DENOMINATOR)
//   );
// }

/**
 * Checks if the transaction's base cost is greater than the provided value, which covers the transaction's cost.
 *
 * @param baseCost The base cost of the transaction.
 * @param value The value covering the transaction's cost.
 * @throws {Error} The base cost must be greater than the provided value.
 *
 * @example
 *
 * import { utils } from "zksync-ethers";
 *
 * const baseCost = 100;
 * const value = 99;
 * try {
 *   await utils.checkBaseCost(baseCost, value);
 * } catch (e) {
 *   // e.message = `The base cost of performing the priority operation is higher than the provided value parameter for the transaction: baseCost: ${baseCost}, provided value: ${value}`,
 * }
 */
// export async function checkBaseCost(
//   baseCost: ethers.BigNumberish,
//   value: ethers.BigNumberish | Promise<ethers.BigNumberish>,
// ): Promise<void> {
//   const resolvedValue = await value;
//   if (baseCost > resolvedValue) {
//     throw new Error(
//       'The base cost of performing the priority operation is higher than the provided value parameter ' +
//         `for the transaction: baseCost: ${String(baseCost)}, provided value: ${String(resolvedValue)}!`,
//     );
//   }
// }
