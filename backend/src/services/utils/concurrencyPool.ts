import pLimit, { LimitFunction } from 'p-limit';

/**
 * Creates a bounded concurrency limiter wrapper around `p-limit` for async worker execution.
 * Handles both pure ESM and CJS interop safely under NodeNext module resolution.
 */
export function createConcurrencyPool(concurrency: number): LimitFunction {
  const limiterFactory = (pLimit as unknown as { default?: typeof pLimit }).default || pLimit;
  return limiterFactory(concurrency);
}

export type { LimitFunction };
