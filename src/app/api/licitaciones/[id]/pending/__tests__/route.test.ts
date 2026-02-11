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

import { PATCH } from '@/app/api/licitaciones/[id]/pending/route';

describe('PATCH /api/licitaciones/[id]/pending', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resets licitacion to pending with notes', async () => {
    const mockLicitacion = { id: 5, approvalStatus: 'pending' };
    mockUpdateApprovalStatus.mockResolvedValue(mockLicitacion);

    const request = createMockNextRequest('http://localhost:3000/api/licitaciones/5/pending', {
      method: 'PATCH',
      body: { notes: 'Need to re-review' },
    });
    const params = Promise.resolve({ id: '5' });
    const result = await PATCH(request, { params });
    const data = await result.json();

    expect(result.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(mockLicitacion);
    expect(mockUpdateApprovalStatus).toHaveBeenCalledWith(5, 'pending', 'Need to re-review');
  });

  it('returns 400 for invalid ID', async () => {
    const request = createMockNextRequest('http://localhost:3000/api/licitaciones/-3/pending', {
      method: 'PATCH',
      body: {},
    });
    const params = Promise.resolve({ id: '-3' });
    const result = await PATCH(request, { params });
    const data = await result.json();

    expect(result.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('ID must be a positive integer');
  });

  it('returns 500 on service error', async () => {
    mockUpdateApprovalStatus.mockRejectedValue(new Error('DB error'));

    const request = createMockNextRequest('http://localhost:3000/api/licitaciones/5/pending', {
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
