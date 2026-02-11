// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockNextRequest } from '@/__tests__/helpers';

const { mockGetById, mockDelete } = vi.hoisted(() => ({
  mockGetById: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('@/lib/services/licitaciones.service', () => {
  return {
    default: class MockLicitacionesService {
      getLicitacionById = mockGetById;
      deleteLicitacion = mockDelete;
    },
  };
});

import { GET, DELETE } from '@/app/api/licitaciones/[id]/route';

describe('GET /api/licitaciones/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns licitacion for valid ID', async () => {
    const mockLicitacion = { id: 5, title: 'Test Licitacion' };
    mockGetById.mockResolvedValue(mockLicitacion);

    const request = createMockNextRequest('http://localhost:3000/api/licitaciones/5');
    const params = Promise.resolve({ id: '5' });
    const result = await GET(request, { params });
    const data = await result.json();

    expect(result.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(mockLicitacion);
    expect(mockGetById).toHaveBeenCalledWith(5);
  });

  it('returns 400 for non-numeric ID', async () => {
    const request = createMockNextRequest('http://localhost:3000/api/licitaciones/abc');
    const params = Promise.resolve({ id: 'abc' });
    const result = await GET(request, { params });
    const data = await result.json();

    expect(result.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('ID must be a positive integer');
  });

  it('returns 400 for zero or negative ID', async () => {
    const request = createMockNextRequest('http://localhost:3000/api/licitaciones/0');
    const params = Promise.resolve({ id: '0' });
    const result = await GET(request, { params });
    const data = await result.json();

    expect(result.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('returns 500 on service error', async () => {
    mockGetById.mockRejectedValue(new Error('DB error'));

    const request = createMockNextRequest('http://localhost:3000/api/licitaciones/5');
    const params = Promise.resolve({ id: '5' });
    const result = await GET(request, { params });
    const data = await result.json();

    expect(result.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Internal server error');
  });
});

describe('DELETE /api/licitaciones/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes and returns result', async () => {
    const mockResult = { id: 5, deleted: true };
    mockDelete.mockResolvedValue(mockResult);

    const request = createMockNextRequest('http://localhost:3000/api/licitaciones/5', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: '5' });
    const result = await DELETE(request, { params });
    const data = await result.json();

    expect(result.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(mockResult);
    expect(mockDelete).toHaveBeenCalledWith(5);
  });

  it('returns 400 for invalid ID', async () => {
    const request = createMockNextRequest('http://localhost:3000/api/licitaciones/-1', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: '-1' });
    const result = await DELETE(request, { params });
    const data = await result.json();

    expect(result.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('ID must be a positive integer');
  });
});
