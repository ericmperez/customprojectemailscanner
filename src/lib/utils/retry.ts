interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const RETRYABLE_ERROR_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN']);
const NON_RETRYABLE_STATUS_CODES = new Set([400, 401, 403, 404]);

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code && RETRYABLE_ERROR_CODES.has(code)) return true;
    if (error.message?.includes('timeout')) return true;
  }

  // Check for HTTP status code on error objects from APIs
  const status = (error as { status?: number })?.status;
  if (typeof status === 'number') {
    if (NON_RETRYABLE_STATUS_CODES.has(status)) return false;
    if (RETRYABLE_STATUS_CODES.has(status)) return true;
  }

  return false;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 1, baseDelayMs = 500, maxDelayMs = 5000 } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt >= maxRetries || !isRetryableError(error)) {
        throw error;
      }

      const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
      const jitter = delay * (0.5 + Math.random() * 0.5);
      console.warn(
        `[retry] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${Math.round(jitter)}ms:`,
        error instanceof Error ? error.message : String(error)
      );
      await new Promise((resolve) => setTimeout(resolve, jitter));
    }
  }

  throw lastError;
}
