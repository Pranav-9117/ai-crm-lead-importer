export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

/**
 * Executes a target async operation with exponential backoff and jitter.
 * Retries only on transient errors (HTTP 429, 500-504, ECONNRESET, ETIMEDOUT, ENOTFOUND).
 */
export async function executeWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void
): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (error: unknown) {
      attempt++;

      const err = (typeof error === 'object' && error !== null ? error : {}) as Record<
        string,
        unknown
      >;
      const status =
        typeof err.status === 'number'
          ? err.status
          : typeof err.statusCode === 'number'
            ? err.statusCode
            : undefined;
      const code = typeof err.code === 'string' ? err.code : undefined;

      // Determine if error is transient
      const isTransient =
        status === 429 ||
        (status !== undefined && status >= 500 && status <= 504) ||
        (code !== undefined && ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'].includes(code));

      if (!isTransient || attempt > options.maxRetries) {
        throw error;
      }

      // Calculate exponential delay: baseDelay * 2^(attempt - 1)
      let delayMs = options.baseDelayMs * Math.pow(2, attempt - 1);

      // Honor Retry-After header if HTTP 429 explicitly provides it
      if (status === 429) {
        const headers =
          (err.headers as Record<string, string> | undefined) ||
          ((err.response as { headers?: Record<string, string> } | undefined)?.headers);
        if (headers && headers['retry-after']) {
          const retryAfterSeconds = parseInt(headers['retry-after'], 10);
          if (!isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
            delayMs = retryAfterSeconds * 1000;
          }
        }
      }

      // Add jitter (0-500ms) and cap at maxDelayMs
      const jitter = Math.floor(Math.random() * 500);
      delayMs = Math.min(delayMs + jitter, options.maxDelayMs);

      if (onRetry) {
        onRetry(attempt, error, delayMs);
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
