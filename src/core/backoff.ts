import type { BackoffConfig } from './interfaces';

export function* backoff(config: Required<BackoffConfig>) {
  let delay = config.base;
  while (true) {
    // jitter
    const jitter = delay * (config.jitter ?? 0);
    const low = delay - jitter;
    const high = delay + jitter;
    const ms = Math.min(config.cap, Math.floor(low + Math.random() * (high - low)));
    yield ms;
    delay = Math.min(config.cap, Math.floor(delay * config.factor));
  }
}
