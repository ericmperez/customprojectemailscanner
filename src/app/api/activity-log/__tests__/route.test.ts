// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockNextRequest } from '@/__tests__/helpers';

const { mockGetOrgDbId, mockGetUserName, mockLogActivity, mockGetActivityLog } = vi.hoisted(() => ({
  mockGetOrgDbId: vi.fn(),
  mockGetUserName: vi.fn(),
  mockLogActivity: vi.fn(),
  mockGetActivityLog: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getOrgDbId: (...args: unknown[]) => mockGetOrgDbId(...args),
  getUserName: (...args: unknown[]) => mockGetUserName(...args),
}));

vi.mock('@/lib/services/supabase.service', () => ({
  logActivity: (...args: unknown[]) => mockLogActivity(...args),
  getActivityLog: (...args: unknown[]) => mockGetActivityLog(...args),
}));

import { GET, POST } from '@/app/api/activity-log/route';

describe('GET /api/activity-log', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrgDbId.mockResolvedValue('org-123');
  });

  it('returns activity entries with default limit/offset', async () => {
    const mockEntries = [
      { id: 1, action: 'approve', created_at: '2025-03-01' },
      { id: 2, action: 'reject', created_at: '2025-03-02' },
    ];
    mockGetActivityLog.mockResolvedValue(mockEntries);

    const request = createMockNextRequest('http://localhost:3000/api/activity-log');
    const result = await GET(request);
    const data = await result.json();

    expect(result.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(mockEntries);
    expect(mockGetActivityLog).toHaveBeenCalledWith('org-123', 50, 0);
  });

  it('respects custom limit and offset params', async () => {
    mockGetActivityLog.mockResolvedValue([]);

    const request = createMockNextRequest('http://localhost:3000/api/activity-log?limit=20&offset=10');
    const result = await GET(request);
    const data = await result.json();

    expect(data.success).toBe(true);
    expect(mockGetActivityLog).toHaveBeenCalledWith('org-123', 20, 10);
  });

  it('caps limit at 100', async () => {
    mockGetActivityLog.mockResolvedValue([]);

    const request = createMockNextRequest('http://localhost:3000/api/activity-log?limit=200');
    const result = await GET(request);
    const data = await result.json();

    expect(data.success).toBe(true);
    expect(mockGetActivityLog).toHaveBeenCalledWith('org-123', 100, 0);
  });

  it('returns 500 on error', async () => {
    mockGetOrgDbId.mockRejectedValue(new Error('Auth error'));

    const request = createMockNextRequest('http://localhost:3000/api/activity-log');
    const result = await GET(request);
    const data = await result.json();

    expect(result.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Internal server error');
  });
});

describe('POST /api/activity-log', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrgDbId.mockResolvedValue('org-123');
    mockGetUserName.mockResolvedValue('Test User');
  });

  it('logs activity with valid action', async () => {
    const request = createMockNextRequest('http://localhost:3000/api/activity-log', {
      method: 'POST',
      body: { action: 'approve', licitacionId: 5, licitacionTitle: 'Test Bid' },
    });
    const result = await POST(request);
    const data = await result.json();

    expect(result.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockLogActivity).toHaveBeenCalledWith('org-123', 'approve', 5, 'Test Bid', 'Test User');
  });

  it('returns 400 when action is missing', async () => {
    const request = createMockNextRequest('http://localhost:3000/api/activity-log', {
      method: 'POST',
      body: { licitacionId: 5 },
    });
    const result = await POST(request);
    const data = await result.json();

    expect(result.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Missing action');
  });

  it('returns 400 when action is not a string', async () => {
    const request = createMockNextRequest('http://localhost:3000/api/activity-log', {
      method: 'POST',
      body: { action: 123 },
    });
    const result = await POST(request);
    const data = await result.json();

    expect(result.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Missing action');
  });

  it('returns 500 on error', async () => {
    mockGetOrgDbId.mockRejectedValue(new Error('Auth error'));

    const request = createMockNextRequest('http://localhost:3000/api/activity-log', {
      method: 'POST',
      body: { action: 'approve' },
    });
    const result = await POST(request);
    const data = await result.json();

    expect(result.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Internal server error');
  });
});
