/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { describe, it, expect, beforeAll } from 'bun:test';
import { formatEnvelopePretty } from '../formatter';
import chalk from 'chalk';

beforeAll(() => {
  // Stabilize snapshots by disabling colors
  chalk.level = 0;
});

describe('errors/formatter.formatEnvelopePretty', () => {
  it('formats a rich envelope with context, step, revert, and cause', () => {
    const envelope = {
      type: 'RPC',
      message: 'Failed to fetch L2→L1 log proof.',
      operation: 'zksrpc.getL2ToL1LogProof',
      resource: 'zksrpc',
      context: {
        txHash: '0x' + 'aa'.repeat(32),
        nonce: 7,
        step: 'fetch-proof',
      },
      revert: {
        selector: '0x08c379a0',
        name: 'Error',
        contract: 'L2MessageVerification',
        fn: 'verify(bytes32)',
        args: ['0x' + '11'.repeat(32)],
      },
      cause: {
        name: 'TimeoutError',
        code: 'ETIMEDOUT',
        message: '5000ms exceeded while waiting for response',
        data: '0xdeadbeefcafebabedeadbeef', // long, will be elided
      },
    } as const;

    const pretty = formatEnvelopePretty(envelope as any);
    expect(pretty).toMatchSnapshot();
  });

  it('handles minimal envelope without optional fields', () => {
    const envelope = {
      type: 'STATE',
      message: 'Proof not yet available. Please try again later.',
      operation: 'zksrpc.getL2ToL1LogProof',
      resource: 'zksrpc',
    };

    const pretty = formatEnvelopePretty(envelope as any);
    expect(pretty).toMatchSnapshot();
  });
});
