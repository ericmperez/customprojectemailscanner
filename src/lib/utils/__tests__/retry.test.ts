import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry } from '@/lib/utils/retry';

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('succeeds on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('ok');

    const result = await withRetry(fn);

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on status 429 (rate limit) and succeeds', async () => {
    const error429 = Object.assign(new Error('rate limited'), { status: 429 });
    const fn = vi.fn()
      .mockRejectedValueOnce(error429)
      .mockResolvedValueOnce('success');

    const promise = withRetry(fn, { maxRetries: 1 });
    await vi.advanceTimersByTimeAsync(10000);
    const result = await promise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on status 500 (server error)', async () => {
    const error500 = Object.assign(new Error('server error'), { status: 500 });
    const fn = vi.fn()
      .mockRejectedValueOnce(error500)
      .mockResolvedValueOnce('recovered');

    const promise = withRetry(fn, { maxRetries: 1 });
    await vi.advanceTimersByTimeAsync(10000);
    const result = await promise;

    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on status 502, 503, and 504', async () => {
    for (const status of [502, 503, 504]) {
      const error = Object.assign(new Error(`error ${status}`), { status });
      const fn = vi.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('ok');

      const promise = withRetry(fn, { maxRetries: 1 });
      await vi.advanceTimersByTimeAsync(10000);
      const result = await promise;

      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    }
  });

  it('retries on ECONNRESET error code', async () => {
    const error = Object.assign(new Error('connection reset'), { code: 'ECONNRESET' });
    const fn = vi.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('reconnected');

    const promise = withRetry(fn, { maxRetries: 1 });
    await vi.advanceTimersByTimeAsync(10000);
    const result = await promise;

    expect(result).toBe('reconnected');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on ETIMEDOUT error code', async () => {
    const error = Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' });
    const fn = vi.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn, { maxRetries: 1 });
    await vi.advanceTimersByTimeAsync(10000);
    const result = await promise;

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry on status 400 (bad request)', async () => {
    const error400 = Object.assign(new Error('bad request'), { status: 400 });
    const fn = vi.fn().mockRejectedValueOnce(error400);

    await expect(withRetry(fn, { maxRetries: 3 })).rejects.toThrow('bad request');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on status 401, 403, 404', async () => {
    for (const status of [401, 403, 404]) {
      const error = Object.assign(new Error(`error ${status}`), { status });
      const fn = vi.fn().mockRejectedValueOnce(error);

      await expect(withRetry(fn, { maxRetries: 3 })).rejects.toThrow(`error ${status}`);
      expect(fn).toHaveBeenCalledTimes(1);
    }
  });

  it('respects maxRetries option', async () => {
    const error = Object.assign(new Error('server error'), { status: 500 });
    const fn = vi.fn().mockRejectedValue(error);

    // Attach a .catch immediately to prevent unhandled rejection
    const promise = withRetry(fn, { maxRetries: 3 });
    const caught = promise.catch((e: Error) => e);

    await vi.advanceTimersByTimeAsync(60000);

    const result = await caught;
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe('server error');
    // 1 initial + 3 retries = 4 total attempts
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it('throws last error after all retries exhausted', async () => {
    const error = Object.assign(new Error('persistent failure'), { status: 503 });
    const fn = vi.fn().mockRejectedValue(error);

    const promise = withRetry(fn, { maxRetries: 2 });
    const caught = promise.catch((e: Error) => e);

    await vi.advanceTimersByTimeAsync(60000);

    const result = await caught;
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe('persistent failure');
  });

  it('default maxRetries is 1 (2 attempts total)', async () => {
    const error = Object.assign(new Error('fail'), { status: 500 });
    const fn = vi.fn().mockRejectedValue(error);

    const promise = withRetry(fn);
    const caught = promise.catch((e: Error) => e);

    await vi.advanceTimersByTimeAsync(60000);

    const result = await caught;
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe('fail');
    // Default maxRetries = 1 => 2 total attempts
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
