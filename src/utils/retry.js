import logger from './logger.js';

/**
 * Execute an async function with exponential backoff retry.
 *
 * @param {Function} fn        — async function to execute
 * @param {Object}  [options]
 * @param {number}  [options.retries=3]      — max retry attempts
 * @param {number}  [options.delay=1000]     — initial delay in ms
 * @param {number}  [options.factor=2]       — backoff multiplier
 * @param {string}  [options.label='operation'] — label for log messages
 * @returns {Promise<*>} Result of fn()
 */
export async function withRetry(fn, options = {}) {
  const {
    retries = 3,
    delay = 1000,
    factor = 2,
    label = 'operation',
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry client errors (4xx) — they won't succeed on retry
      const status = error?.status ?? error?.response?.status ?? error?.code;
      if (typeof status === 'number' && status >= 400 && status < 500) {
        logger.warn(`[retry] ${label} failed with ${status} (not retryable)`);
        throw error;
      }

      if (attempt < retries) {
        const waitMs = delay * Math.pow(factor, attempt);
        logger.warn(
          `[retry] ${label} attempt ${attempt + 1}/${retries + 1} failed, retrying in ${waitMs}ms...`,
          { error: error.message }
        );
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
  }

  logger.error(`[retry] ${label} failed after ${retries + 1} attempts`);
  throw lastError;
}
