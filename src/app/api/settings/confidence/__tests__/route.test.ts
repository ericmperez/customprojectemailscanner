// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockNextRequest } from '@/__tests__/helpers';

const { mockGetConfidenceSettings, mockSaveConfidenceSettings } = vi.hoisted(() => ({
  mockGetConfidenceSettings: vi.fn(),
  mockSaveConfidenceSettings: vi.fn(),
}));

vi.mock('@/lib/services/supabase.service', () => ({
  getConfidenceSettings: (...args: unknown[]) => mockGetConfidenceSettings(...args),
  saveConfidenceSettings: (...args: unknown[]) => mockSaveConfidenceSettings(...args),
}));

import { GET, PUT } from '@/app/api/settings/confidence/route';

const ALL_FIELDS = [
  'title', 'location', 'description', 'summary', 'category',
  'siteVisitDate', 'siteVisitTime', 'visitLocation', 'contactName',
  'contactPhone', 'biddingCloseDate', 'biddingCloseTime', 'estimatedValue',
];

describe('GET /api/settings/confidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns settings on success', async () => {
    const mockSettings = {
      critical: ['title', 'location'],
      optional: ['description'],
      ignored: ALL_FIELDS.filter((f) => !['title', 'location', 'description'].includes(f)),
    };
    mockGetConfidenceSettings.mockResolvedValue(mockSettings);

    const result = await GET();
    const data = await result.json();

    expect(result.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(mockSettings);
  });

  it('returns 500 on error', async () => {
    mockGetConfidenceSettings.mockRejectedValue(new Error('DB error'));

    const result = await GET();
    const data = await result.json();

    expect(result.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Internal server error');
  });
});

describe('PUT /api/settings/confidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saves valid settings', async () => {
    const validSettings = {
      critical: ['title', 'location', 'description'],
      optional: ['summary', 'category', 'siteVisitDate', 'siteVisitTime'],
      ignored: ['visitLocation', 'contactName', 'contactPhone', 'biddingCloseDate', 'biddingCloseTime', 'estimatedValue'],
    };
    mockSaveConfidenceSettings.mockResolvedValue(undefined);

    const request = createMockNextRequest('http://localhost:3000/api/settings/confidence', {
      method: 'PUT',
      body: validSettings,
    });
    const result = await PUT(request);
    const data = await result.json();

    expect(result.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(validSettings);
    expect(mockSaveConfidenceSettings).toHaveBeenCalledWith(validSettings);
  });

  it('rejects duplicate fields with 400', async () => {
    const duplicateSettings = {
      critical: ['title', 'location'],
      optional: ['title', 'description'],
      ignored: ALL_FIELDS.filter((f) => !['title', 'location', 'description'].includes(f)),
    };

    const request = createMockNextRequest('http://localhost:3000/api/settings/confidence', {
      method: 'PUT',
      body: duplicateSettings,
    });
    const result = await PUT(request);
    const data = await result.json();

    expect(result.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('exactly once');
  });

  it('rejects unknown fields with 400', async () => {
    const unknownFieldSettings = {
      critical: ['title', 'location', 'unknownField'],
      optional: ['summary', 'category', 'siteVisitDate', 'siteVisitTime'],
      ignored: ['visitLocation', 'contactName', 'contactPhone', 'biddingCloseDate', 'biddingCloseTime', 'estimatedValue'],
    };

    const request = createMockNextRequest('http://localhost:3000/api/settings/confidence', {
      method: 'PUT',
      body: unknownFieldSettings,
    });
    const result = await PUT(request);
    const data = await result.json();

    expect(result.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('rejects missing fields with 400', async () => {
    const missingFieldSettings = {
      critical: ['title'],
      optional: ['summary'],
      ignored: ['location'],
    };

    const request = createMockNextRequest('http://localhost:3000/api/settings/confidence', {
      method: 'PUT',
      body: missingFieldSettings,
    });
    const result = await PUT(request);
    const data = await result.json();

    expect(result.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('exactly once');
  });
});
