// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetStats } = vi.hoisted(() => ({
  mockGetStats: vi.fn(),
}));

vi.mock('@/lib/services/licitaciones.service', () => {
  return {
    default: class MockLicitacionesService {
      getStats = mockGetStats;
    },
  };
});

import { GET } from '@/app/api/stats/route';

describe('GET /api/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns stats on success', async () => {
    const mockStats = { total: 50, pending: 10, approved: 30, rejected: 10 };
    mockGetStats.mockResolvedValue(mockStats);

    const result = await GET();
    const data = await result.json();

    expect(result.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(mockStats);
  });

  it('returns 500 on error', async () => {
    mockGetStats.mockRejectedValue(new Error('DB error'));

    const result = await GET();
    const data = await result.json();

    expect(result.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Internal server error');
  });
});
