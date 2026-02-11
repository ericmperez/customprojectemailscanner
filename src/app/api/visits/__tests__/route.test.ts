// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockNextRequest } from '@/__tests__/helpers';

const { mockGetSiteVisitEvents } = vi.hoisted(() => ({
  mockGetSiteVisitEvents: vi.fn(),
}));

vi.mock('@/lib/services/licitaciones.service', () => {
  return {
    default: class MockLicitacionesService {
      getSiteVisitEvents = mockGetSiteVisitEvents;
    },
  };
});

import { GET } from '@/app/api/visits/route';

describe('GET /api/visits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns visits on success', async () => {
    const mockVisits = [{ id: 1, siteVisitDate: '2025-03-15' }];
    mockGetSiteVisitEvents.mockResolvedValue(mockVisits);

    const request = createMockNextRequest('http://localhost:3000/api/visits');
    const result = await GET(request);
    const data = await result.json();

    expect(result.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(mockVisits);
  });

  it('passes filters correctly', async () => {
    mockGetSiteVisitEvents.mockResolvedValue([]);

    const request = createMockNextRequest(
      'http://localhost:3000/api/visits?status=approved&visitLocation=San+Juan'
    );
    const result = await GET(request);
    const data = await result.json();

    expect(data.success).toBe(true);
    expect(mockGetSiteVisitEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'approved',
        visitLocation: ['San Juan'],
      })
    );
  });

  it('returns 500 on error', async () => {
    mockGetSiteVisitEvents.mockRejectedValue(new Error('DB error'));

    const request = createMockNextRequest('http://localhost:3000/api/visits');
    const result = await GET(request);
    const data = await result.json();

    expect(result.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Internal server error');
  });
});
