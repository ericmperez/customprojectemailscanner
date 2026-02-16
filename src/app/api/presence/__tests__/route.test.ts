// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockGetOrgDbId,
  mockAuth,
  mockFrom,
  mockSelect,
  mockEq,
  mockGte,
  mockSingle,
  mockUpsert,
} = vi.hoisted(() => {
  const mockUpsert = vi.fn();
  const mockSingle = vi.fn();
  const mockGte = vi.fn();
  // Build chainable query builder mocks
  const mockEq = vi.fn();
  const mockSelect = vi.fn();
  const mockFrom = vi.fn();

  return {
    mockGetOrgDbId: vi.fn(),
    mockAuth: vi.fn(),
    mockFrom,
    mockSelect,
    mockEq,
    mockGte,
    mockSingle,
    mockUpsert,
  };
});

vi.mock('@/lib/auth', () => ({
  getOrgDbId: (...args: unknown[]) => mockGetOrgDbId(...args),
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

import { GET, POST } from '@/app/api/presence/route';

describe('GET /api/presence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = 'http://localhost';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    mockGetOrgDbId.mockResolvedValue('org-123');
  });

  it('returns online users', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const mockData = [
      {
        user_id: 'user-1',
        user_name: 'Alice',
        user_image_url: 'https://img.example.com/alice.jpg',
        last_heartbeat: new Date().toISOString(),
        seconds_today: 3600,
        today_date: today,
      },
      {
        user_id: 'user-2',
        user_name: null,
        user_image_url: null,
        last_heartbeat: new Date().toISOString(),
        seconds_today: 1800,
        today_date: today,
      },
    ];

    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ gte: mockGte });
    mockGte.mockResolvedValue({ data: mockData, error: null });

    const result = await GET();
    const data = await result.json();

    expect(result.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual([
      { userId: 'user-1', name: 'Alice', imageUrl: 'https://img.example.com/alice.jpg', secondsToday: 3600 },
      { userId: 'user-2', name: 'Usuario', imageUrl: '', secondsToday: 1800 },
    ]);
    expect(mockFrom).toHaveBeenCalledWith('user_presence');
  });

  it('returns secondsToday as 0 when today_date does not match', async () => {
    const mockData = [
      {
        user_id: 'user-1',
        user_name: 'Alice',
        user_image_url: '',
        last_heartbeat: new Date().toISOString(),
        seconds_today: 3600,
        today_date: '2020-01-01', // old date
      },
    ];

    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ gte: mockGte });
    mockGte.mockResolvedValue({ data: mockData, error: null });

    const result = await GET();
    const data = await result.json();

    expect(data.data[0].secondsToday).toBe(0);
  });

  it('returns 500 on supabase error', async () => {
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ gte: mockGte });
    mockGte.mockResolvedValue({ data: null, error: new Error('Supabase connection failed') });

    const result = await GET();
    const data = await result.json();

    expect(result.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Supabase connection failed');
  });

  it('returns 500 when getOrgDbId throws', async () => {
    mockGetOrgDbId.mockRejectedValue(new Error('Auth error'));

    const result = await GET();
    const data = await result.json();

    expect(result.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Auth error');
  });
});

describe('POST /api/presence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = 'http://localhost';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    mockGetOrgDbId.mockResolvedValue('org-123');
  });

  it('creates heartbeat for authenticated user', async () => {
    mockAuth.mockResolvedValue({
      userId: 'user-1',
      sessionClaims: { full_name: 'Alice Smith', image_url: 'https://img.example.com/alice.jpg' },
    });

    // Mock select for existing record lookup
    mockFrom.mockReturnValue({ select: mockSelect, upsert: mockUpsert });
    mockSelect.mockReturnValue({ eq: mockEq });
    // First eq returns chainable, second eq returns single
    mockEq.mockReturnValueOnce({ eq: mockEq });
    mockEq.mockReturnValueOnce({ single: mockSingle });
    mockSingle.mockResolvedValue({ data: null, error: null });

    // Reset mockFrom for upsert call (second call to from)
    mockFrom.mockReturnValueOnce({ select: mockSelect }).mockReturnValueOnce({ upsert: mockUpsert });
    mockUpsert.mockResolvedValue({ error: null });

    const result = await POST();
    const data = await result.json();

    expect(result.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null, sessionClaims: null });

    const result = await POST();
    const data = await result.json();

    expect(result.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Not authenticated');
  });

  it('returns 500 on error', async () => {
    mockAuth.mockResolvedValue({
      userId: 'user-1',
      sessionClaims: { full_name: 'Alice' },
    });

    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValueOnce({ eq: mockEq });
    mockEq.mockReturnValueOnce({ single: mockSingle });
    mockSingle.mockRejectedValue(new Error('DB connection lost'));

    const result = await POST();
    const data = await result.json();

    expect(result.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('DB connection lost');
  });

  it('builds userName from first/last name when full_name is missing', async () => {
    mockAuth.mockResolvedValue({
      userId: 'user-1',
      sessionClaims: { first_name: 'Alice', last_name: 'Smith' },
    });

    mockFrom.mockReturnValueOnce({ select: mockSelect }).mockReturnValueOnce({ upsert: mockUpsert });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValueOnce({ eq: mockEq });
    mockEq.mockReturnValueOnce({ single: mockSingle });
    mockSingle.mockResolvedValue({ data: null, error: null });
    mockUpsert.mockResolvedValue({ error: null });

    const result = await POST();
    const data = await result.json();

    expect(result.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_name: 'Alice Smith' }),
      expect.any(Object)
    );
  });
});
