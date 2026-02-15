// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockNextRequest } from '@/__tests__/helpers';

const { mockUpdateFields } = vi.hoisted(() => ({
  mockUpdateFields: vi.fn(),
}));

vi.mock('@/lib/services/licitaciones.service', () => {
  return {
    default: class MockLicitacionesService {
      updateFields = mockUpdateFields;
    },
  };
});

import { PATCH } from '@/app/api/licitaciones/[id]/update-fields/route';

describe('PATCH /api/licitaciones/[id]/update-fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates interested field', async () => {
    const mockLicitacion = { id: 5, interested: true };
    mockUpdateFields.mockResolvedValue({ updated: mockLicitacion, oldValues: { interested: 'false' } });

    const request = createMockNextRequest(
      'http://localhost:3000/api/licitaciones/5/update-fields',
      { method: 'PATCH', body: { interested: true } }
    );
    const params = Promise.resolve({ id: '5' });
    const result = await PATCH(request, { params });
    const data = await result.json();

    expect(result.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(mockLicitacion);
    expect(mockUpdateFields).toHaveBeenCalledWith(5, { interested: true });
  });

  it('updates decisionStatus field', async () => {
    const mockLicitacion = { id: 5, decisionStatus: 'bid-submitted' };
    mockUpdateFields.mockResolvedValue({ updated: mockLicitacion, oldValues: { decisionStatus: '' } });

    const request = createMockNextRequest(
      'http://localhost:3000/api/licitaciones/5/update-fields',
      { method: 'PATCH', body: { decisionStatus: 'bid-submitted' } }
    );
    const params = Promise.resolve({ id: '5' });
    const result = await PATCH(request, { params });
    const data = await result.json();

    expect(result.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockUpdateFields).toHaveBeenCalledWith(5, { decisionStatus: 'bid-submitted' });
  });

  it('rejects invalid decisionStatus with 400', async () => {
    const request = createMockNextRequest(
      'http://localhost:3000/api/licitaciones/5/update-fields',
      { method: 'PATCH', body: { decisionStatus: 'invalid-status' } }
    );
    const params = Promise.resolve({ id: '5' });
    const result = await PATCH(request, { params });
    const data = await result.json();

    expect(result.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Invalid decisionStatus');
  });

  it('rejects empty body with 400', async () => {
    const request = createMockNextRequest(
      'http://localhost:3000/api/licitaciones/5/update-fields',
      { method: 'PATCH', body: {} }
    );
    const params = Promise.resolve({ id: '5' });
    const result = await PATCH(request, { params });
    const data = await result.json();

    expect(result.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('No valid fields to update');
  });

  it('returns 400 for invalid ID', async () => {
    const request = createMockNextRequest(
      'http://localhost:3000/api/licitaciones/abc/update-fields',
      { method: 'PATCH', body: { interested: true } }
    );
    const params = Promise.resolve({ id: 'abc' });
    const result = await PATCH(request, { params });
    const data = await result.json();

    expect(result.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('ID must be a positive integer');
  });
});
