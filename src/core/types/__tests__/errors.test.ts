// src/core/types/__tests__/errors.test.ts
// import { ZKosError, isZKosError } from '../errors';

// test('ZKosError carries envelope', () => {
//   const err = new ZKosError({
//     code: 'finalization/not_ready',
//     message: 'Withdrawal is not ready.',
//     operation: 'withdrawals.finalize',
//     type: 'STATE',
//     recommendedAction: 'WAIT_AND_RETRY',
//   });
//   expect(err.name).toBe('ZKosError');
//   expect(err.envelope.code).toBe('finalization/not_ready');
//   expect(isZKosError(err)).toBe(true);
// });
