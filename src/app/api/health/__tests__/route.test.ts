// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSelect, mockFrom } = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockFrom = vi.fn(() => ({ select: mockSelect }));
  return { mockSelect, mockFrom };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

import { GET } from '@/app/api/health/route';

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = 'http://localhost';
    process.env.SUPABASE_KEY = 'test';
  });

  it('returns healthy when Supabase is reachable', async () => {
    mockSelect.mockReturnValue({ limit: vi.fn().mockResolvedValue({ error: null }) });

    const result = await GET();
    const data = await result.json();

    expect(result.status).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data.timestamp).toBeDefined();
  });

  it('returns degraded when env vars are missing', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_KEY;

    const result = await GET();
    const data = await result.json();

    expect(result.status).toBe(503);
    expect(data.status).toBe('degraded');
    expect(data.reason).toBe('Missing Supabase config');
  });

  it('returns degraded when Supabase query fails', async () => {
    mockSelect.mockReturnValue({
      limit: vi.fn().mockResolvedValue({ error: new Error('connection refused') }),
    });

    const result = await GET();
    const data = await result.json();

    expect(result.status).toBe(503);
    expect(data.status).toBe('degraded');
    expect(data.reason).toBe('Supabase unreachable');
  });

  it('returns unhealthy when createClient throws', async () => {
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockImplementationOnce(() => {
      throw new Error('Fatal error');
    });

    const result = await GET();
    const data = await result.json();

    expect(result.status).toBe(503);
    expect(data.status).toBe('unhealthy');
    expect(data.reason).toBe('Health check failed');
  });
});
