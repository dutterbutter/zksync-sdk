/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-base-to-string */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* -------------------- Formatting helpers -------------------- */
import type { ErrorEnvelope } from '../types';
import chalk from 'chalk';

function elideMiddle(s: string, max = 96): string {
  if (s.length <= max) return s;
  const keep = Math.max(10, Math.floor((max - 1) / 2));
  return `${s.slice(0, keep)}…${s.slice(-keep)}`;
}

function shortJSON(v: unknown, max = 240): string {
  try {
    const s = JSON.stringify(v, (_k, val) =>
      typeof val === 'bigint' ? `${val.toString()}n` : val,
    );
    return s.length > max ? elideMiddle(s, max) : s;
  } catch {
    return String(v);
  }
}

function kv(label: string, value: string): string {
  const width = 10;
  const pad = label.length >= width ? ' ' : ' '.repeat(width - label.length);
  return `${chalk.dim(label + pad)}: ${value}`;
}

function formatContextLine(ctx?: Record<string, unknown>): string | undefined {
  if (!ctx) return;
  const txHash = ctx['txHash'] ?? ctx['l1TxHash'] ?? ctx['hash'];
  const nonce = ctx['nonce'];
  const parts: string[] = [];
  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
  if (txHash !== undefined) parts.push(`txHash=${txHash ?? '<none>'}`);
  if (nonce !== undefined) parts.push(`nonce=${String(nonce)}`);
  return parts.length ? `  ${kv('Context', parts.join('  •  '))}` : undefined;
}

function formatStep(ctx?: Record<string, unknown>): string | undefined {
  const step = ctx && typeof ctx['step'] === 'string' ? ctx['step'] : undefined;
  return step ? `  ${kv('Step', step)}` : undefined;
}

function formatRevert(r?: ErrorEnvelope['revert']): string | undefined {
  if (!r) return;
  const first = [`selector=${r.selector}`];
  const lines: string[] = [];
  lines.push(`  ${kv('Revert', first.join(' '))}`);
  if (r.name) lines.push(`              ${chalk.cyan('name=')}${r.name}`);
  if (r.contract) lines.push(`              ${chalk.cyan('contract=')}${r.contract}`);
  if (r.fn) lines.push(`              ${chalk.cyan('fn=')}${r.fn}`);
  if (r.args && r.args.length) {
    lines.push(`              ${chalk.cyan('args=')}${shortJSON(r.args, 120)}`);
  }
  return lines.join('\n');
}

function formatCause(c?: any): string[] {
  if (!c) return [];
  const out: string[] = [];
  const head: string[] = [];
  if (c.name) head.push(`name=${c.name}`);
  if (c.code) head.push(`code=${c.code}`);
  if (head.length) out.push(`  ${kv('Cause', head.join('  '))}`);

  if (c.message) {
    out.push(`              message=${elideMiddle(String(c.message), 600)}`);
  }
  if (c.data) {
    out.push(`              data=${elideMiddle(String(c.data), 200)}`);
  }
  return out;
}

export function formatEnvelopePretty(e: ErrorEnvelope): string {
  const lines: string[] = [];

  // Header
  lines.push(`${chalk.red('✖')} ${chalk.bold('ZKsyncError')} [${chalk.yellow(e.type)}]`);
  lines.push(`  ${kv('Message', e.message)}`);
  lines.push('');

  lines.push(`  ${kv('Operation', e.operation)}`);
  lines.push(`  ${kv('Resource', e.resource)}`);
  const step = formatStep(e.context);
  if (step) lines.push(step);
  lines.push('');

  const ctxLine = formatContextLine(e.context);
  if (ctxLine) lines.push(ctxLine);

  const rv = formatRevert(e.revert);
  if (rv) lines.push(rv);

  const causeLines = formatCause(e.cause as any);
  if (causeLines.length) {
    if (!ctxLine && !rv) lines.push('');
    lines.push(...causeLines);
  }

  return lines.join('\n');
}
