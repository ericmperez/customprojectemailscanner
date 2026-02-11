// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockNextRequest } from '@/__tests__/helpers';

const { mockUpdateApprovalStatus } = vi.hoisted(() => ({
  mockUpdateApprovalStatus: vi.fn(),
}));

vi.mock('@/lib/services/licitaciones.service', () => {
  return {
    default: class MockLicitacionesService {
      updateApprovalStatus = mockUpdateApprovalStatus;
    },
  };
});

import { PATCH } from '@/app/api/licitaciones/[id]/reject/route';

describe('PATCH /api/licitaciones/[id]/reject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects licitacion with notes', async () => {
    const mockLicitacion = { id: 5, approvalStatus: 'rejected' };
    mockUpdateApprovalStatus.mockResolvedValue(mockLicitacion);

    const request = createMockNextRequest('http://localhost:3000/api/licitaciones/5/reject', {
      method: 'PATCH',
      body: { notes: 'Not relevant' },
    });
    const params = Promise.resolve({ id: '5' });
    const result = await PATCH(request, { params });
    const data = await result.json();

    expect(result.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(mockLicitacion);
    expect(mockUpdateApprovalStatus).toHaveBeenCalledWith(5, 'rejected', 'Not relevant');
  });

  it('returns 400 for invalid ID', async () => {
    const request = createMockNextRequest('http://localhost:3000/api/licitaciones/0/reject', {
      method: 'PATCH',
      body: {},
    });
    const params = Promise.resolve({ id: '0' });
    const result = await PATCH(request, { params });
    const data = await result.json();

    expect(result.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('ID must be a positive integer');
  });

  it('returns 500 on service error', async () => {
    mockUpdateApprovalStatus.mockRejectedValue(new Error('DB error'));

    const request = createMockNextRequest('http://localhost:3000/api/licitaciones/5/reject', {
      method: 'PATCH',
      body: {},
    });
    const params = Promise.resolve({ id: '5' });
    const result = await PATCH(request, { params });
    const data = await result.json();

    expect(result.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Internal server error');
  });
});
