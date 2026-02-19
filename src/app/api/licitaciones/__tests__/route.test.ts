// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockNextRequest } from '@/__tests__/helpers';

const { mockGetAll } = vi.hoisted(() => ({
  mockGetAll: vi.fn(),
}));

vi.mock('@/lib/services/licitaciones.service', () => {
  return {
    default: class MockLicitacionesService {
      getAllLicitaciones = mockGetAll;
    },
  };
});

// Import after mocks are set up
import { GET } from '@/app/api/licitaciones/route';

describe('GET /api/licitaciones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns licitaciones array with success:true', async () => {
    const mockData = [{ id: 1, title: 'Test' }];
    mockGetAll.mockResolvedValue(mockData);

    const request = createMockNextRequest('http://localhost:3000/api/licitaciones');
    const result = await GET(request);
    const data = await result.json();

    expect(result.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(mockData);
  });

  it('passes filters from query params', async () => {
    mockGetAll.mockResolvedValue([]);

    const request = createMockNextRequest(
      'http://localhost:3000/api/licitaciones?status=pending&category=obras&visitLocation=San+Juan,Ponce'
    );
    const result = await GET(request);
    const data = await result.json();

    expect(data.success).toBe(true);
    expect(mockGetAll).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pending',
        category: 'obras',
        visitLocation: ['San Juan', 'Ponce'],
      })
    );
  });

  it('returns 500 on error', async () => {
    mockGetAll.mockRejectedValue(new Error('DB error'));

    const request = createMockNextRequest('http://localhost:3000/api/licitaciones');
    const result = await GET(request);
    const data = await result.json();

    expect(result.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Internal server error');
  });
});
