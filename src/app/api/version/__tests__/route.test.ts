// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import after environment is set
import { GET } from '@/app/api/version/route';

describe('GET /api/version', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_BUILD_ID;
    delete process.env.VERCEL_DEPLOYMENT_ID;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns buildId from NEXT_BUILD_ID env var', async () => {
    process.env.NEXT_BUILD_ID = 'build-abc123';
    process.env.VERCEL_DEPLOYMENT_ID = 'dpl-xyz789';

    const result = await GET();
    const data = await result.json();

    expect(result.status).toBe(200);
    expect(data.buildId).toBe('build-abc123');
  });

  it('falls back to VERCEL_DEPLOYMENT_ID when NEXT_BUILD_ID is not set', async () => {
    process.env.VERCEL_DEPLOYMENT_ID = 'dpl-xyz789';

    const result = await GET();
    const data = await result.json();

    expect(result.status).toBe(200);
    expect(data.buildId).toBe('dpl-xyz789');
  });

  it('falls back to __dev__ when no env vars are set', async () => {
    const result = await GET();
    const data = await result.json();

    expect(result.status).toBe(200);
    expect(data.buildId).toBe('__dev__');
  });

  it('always returns 200', async () => {
    const result = await GET();

    expect(result.status).toBe(200);
  });
});
