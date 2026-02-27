// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockNextRequest } from '@/__tests__/helpers';

const { mockGetOrgDbId, mockGetAll, mockAutoDeleteExpired } = vi.hoisted(() => ({
  mockGetOrgDbId: vi.fn().mockResolvedValue('org-123'),
  mockGetAll: vi.fn(),
  mockAutoDeleteExpired: vi.fn().mockResolvedValue(0),
}));

vi.mock('@/lib/auth', () => ({
  getOrgDbId: (...args: unknown[]) => mockGetOrgDbId(...args),
}));

vi.mock('@/lib/services/licitaciones.service', () => {
  return {
    default: class MockLicitacionesService {
      getAllLicitaciones = mockGetAll;
      autoDeleteExpired = mockAutoDeleteExpired;
    },
  };
});

// Import after mocks are set up
import { GET } from '@/app/api/licitaciones/route';

describe('GET /api/licitaciones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrgDbId.mockResolvedValue('org-123');
    mockAutoDeleteExpired.mockResolvedValue(0);
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
      'org-123',
      expect.objectContaining({
        status: 'pending',
        category: 'obras',
        visitLocation: ['San Juan', 'Ponce'],
      })
    );
  });

  it('calls autoDeleteExpired fire-and-forget on each request', async () => {
    mockGetAll.mockResolvedValue([]);

    const request = createMockNextRequest('http://localhost:3000/api/licitaciones');
    await GET(request);

    // Allow microtasks to flush
    await Promise.resolve();

    expect(mockAutoDeleteExpired).toHaveBeenCalledWith('org-123');
  });

  it('still returns results when autoDeleteExpired fails', async () => {
    const mockData = [{ id: 1, title: 'Test' }];
    mockGetAll.mockResolvedValue(mockData);
    mockAutoDeleteExpired.mockRejectedValue(new Error('Delete failed'));

    const request = createMockNextRequest('http://localhost:3000/api/licitaciones');
    const result = await GET(request);
    const data = await result.json();

    // Auto-delete failure must not break the main list response
    expect(result.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(mockData);
  });

  it('returns 500 on error', async () => {
    mockGetAll.mockRejectedValue(new Error('DB error'));

    const request = createMockNextRequest('http://localhost:3000/api/licitaciones');
    const result = await GET(request);
    const data = await result.json();

    expect(result.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('DB error');
  });
});
