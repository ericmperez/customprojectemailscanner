// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockGetOrgDbId,
  mockGetUserName,
  mockProcessNewEmails,
  mockCreateGmailServiceForOrg,
  mockSaveLastFetchTimestamp,
  mockLogActivity,
} = vi.hoisted(() => ({
  mockGetOrgDbId: vi.fn(),
  mockGetUserName: vi.fn(),
  mockProcessNewEmails: vi.fn(),
  mockCreateGmailServiceForOrg: vi.fn(),
  mockSaveLastFetchTimestamp: vi.fn(),
  mockLogActivity: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getOrgDbId: (...args: unknown[]) => mockGetOrgDbId(...args),
  getUserName: (...args: unknown[]) => mockGetUserName(...args),
}));

vi.mock('@/lib/services/email-processor', () => ({
  processNewEmails: (...args: unknown[]) => mockProcessNewEmails(...args),
}));

vi.mock('@/lib/services/gmail.service', () => ({
  createGmailServiceForOrg: (...args: unknown[]) => mockCreateGmailServiceForOrg(...args),
}));

vi.mock('@/lib/services/supabase.service', () => ({
  saveLastFetchTimestamp: (...args: unknown[]) => mockSaveLastFetchTimestamp(...args),
  logActivity: (...args: unknown[]) => mockLogActivity(...args),
}));

import { POST } from '@/app/api/fetch-emails/route';

describe('POST /api/fetch-emails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrgDbId.mockResolvedValue('org-123');
    mockGetUserName.mockResolvedValue('Test User');
    mockCreateGmailServiceForOrg.mockResolvedValue({ fake: 'gmail-service' });
    mockSaveLastFetchTimestamp.mockResolvedValue(undefined);
  });

  it('processes emails and returns stats', async () => {
    const mockStats = { emailsFound: 3, processed: 2, errors: 0 };
    mockProcessNewEmails.mockResolvedValue(mockStats);

    const result = await POST();
    const data = await result.json();

    expect(result.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Processed 2 of 3 emails');
    expect(data.stats).toEqual(mockStats);
    expect(data.duration).toBeDefined();
  });

  it('saves timestamp and logs activity after processing', async () => {
    const mockStats = { emailsFound: 1, processed: 1, errors: 0 };
    mockProcessNewEmails.mockResolvedValue(mockStats);

    await POST();

    expect(mockSaveLastFetchTimestamp).toHaveBeenCalledWith('org-123', 'Test User');
    expect(mockLogActivity).toHaveBeenCalledWith(
      'org-123',
      'fetch_emails',
      null,
      null,
      'Test User',
      { emailsFound: 1, processed: 1 }
    );
  });

  it('passes gmail service to processNewEmails', async () => {
    const mockStats = { emailsFound: 0, processed: 0, errors: 0 };
    mockProcessNewEmails.mockResolvedValue(mockStats);
    const fakeGmailService = { fake: 'gmail-service' };
    mockCreateGmailServiceForOrg.mockResolvedValue(fakeGmailService);

    await POST();

    expect(mockCreateGmailServiceForOrg).toHaveBeenCalledWith('org-123');
    expect(mockProcessNewEmails).toHaveBeenCalledWith(
      'org-123',
      expect.any(Number),
      0,
      fakeGmailService
    );
  });

  it('passes undefined when gmail service returns null', async () => {
    const mockStats = { emailsFound: 0, processed: 0, errors: 0 };
    mockProcessNewEmails.mockResolvedValue(mockStats);
    mockCreateGmailServiceForOrg.mockResolvedValue(null);

    await POST();

    expect(mockProcessNewEmails).toHaveBeenCalledWith(
      'org-123',
      expect.any(Number),
      0,
      undefined
    );
  });

  it('returns 500 on error with error message', async () => {
    mockGetOrgDbId.mockRejectedValue(new Error('Auth failed'));

    const result = await POST();
    const data = await result.json();

    expect(result.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Auth failed');
    expect(data.duration).toBeDefined();
  });

  it('returns 500 when processNewEmails throws', async () => {
    mockProcessNewEmails.mockRejectedValue(new Error('Gmail API error'));

    const result = await POST();
    const data = await result.json();

    expect(result.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Gmail API error');
  });
});
