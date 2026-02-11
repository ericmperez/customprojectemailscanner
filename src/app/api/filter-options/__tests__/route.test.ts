// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetDistinctFilterValues } = vi.hoisted(() => ({
  mockGetDistinctFilterValues: vi.fn(),
}));

vi.mock('@/lib/services/licitaciones.service', () => {
  return {
    default: class MockLicitacionesService {
      getDistinctFilterValues = mockGetDistinctFilterValues;
    },
  };
});

import { GET } from '@/app/api/filter-options/route';

describe('GET /api/filter-options', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns filter options on success', async () => {
    const mockOptions = {
      categories: ['obras', 'servicios'],
      locations: ['San Juan', 'Ponce'],
    };
    mockGetDistinctFilterValues.mockResolvedValue(mockOptions);

    const result = await GET();
    const data = await result.json();

    expect(result.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(mockOptions);
  });

  it('returns 500 on error', async () => {
    mockGetDistinctFilterValues.mockRejectedValue(new Error('DB error'));

    const result = await GET();
    const data = await result.json();

    expect(result.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Internal server error');
  });
});
