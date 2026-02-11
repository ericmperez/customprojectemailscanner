// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockNextRequest } from '@/__tests__/helpers';

const {
  mockSearchLicitacionEmails,
  mockGetEmailDetails,
  mockMarkAsRead,
  mockUpsertLicitacion,
  mockExtractLicitacionData,
  mockIsEmailProcessed,
  mockMarkEmailAsProcessed,
  mockUploadPdf,
  mockGetAllProcessedEmailIds,
} = vi.hoisted(() => ({
  mockSearchLicitacionEmails: vi.fn(),
  mockGetEmailDetails: vi.fn(),
  mockMarkAsRead: vi.fn(),
  mockUpsertLicitacion: vi.fn(),
  mockExtractLicitacionData: vi.fn(),
  mockIsEmailProcessed: vi.fn(),
  mockMarkEmailAsProcessed: vi.fn(),
  mockUploadPdf: vi.fn(),
  mockGetAllProcessedEmailIds: vi.fn(),
}));

// Mock GmailService
vi.mock('@/lib/services/gmail.service', () => {
  return {
    default: class MockGmailService {
      searchLicitacionEmails = mockSearchLicitacionEmails;
      getEmailDetails = mockGetEmailDetails;
      markAsRead = mockMarkAsRead;
    },
  };
});

// Mock SheetsService
vi.mock('@/lib/services/sheets.service', () => {
  return {
    default: class MockSheetsService {
      upsertLicitacion = mockUpsertLicitacion;
    },
  };
});

// Mock OpenAI service
vi.mock('@/lib/services/openai.service', () => ({
  extractLicitacionData: (...args: unknown[]) => mockExtractLicitacionData(...args),
}));

// Mock Supabase service
vi.mock('@/lib/services/supabase.service', () => ({
  isEmailProcessed: (...args: unknown[]) => mockIsEmailProcessed(...args),
  markEmailAsProcessed: (...args: unknown[]) => mockMarkEmailAsProcessed(...args),
  uploadPdf: (...args: unknown[]) => mockUploadPdf(...args),
  getAllProcessedEmailIds: (...args: unknown[]) => mockGetAllProcessedEmailIds(...args),
}));

// Mock cron utils
vi.mock('@/lib/services/cron.utils', () => ({
  isBiddingOpen: vi.fn().mockReturnValue(true),
  isMinutaOrAsistencia: vi.fn().mockReturnValue(false),
}));

import { GET } from '@/app/api/cron/process-emails/route';

describe('GET /api/cron/process-emails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
  });

  it('returns 401 without valid bearer token', async () => {
    const request = createMockNextRequest('http://localhost:3000/api/cron/process-emails', {
      headers: { authorization: 'Bearer wrong-secret' },
    });
    const result = await GET(request);
    const data = await result.json();

    expect(result.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns success with no emails found', async () => {
    mockSearchLicitacionEmails.mockResolvedValue([]);

    const request = createMockNextRequest('http://localhost:3000/api/cron/process-emails', {
      headers: { authorization: 'Bearer test-secret' },
    });
    const result = await GET(request);
    const data = await result.json();

    expect(result.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('No licitacion emails found');
    expect(data.stats.emailsFound).toBe(0);
  });

  it('processes emails successfully', async () => {
    mockSearchLicitacionEmails.mockResolvedValue(['msg-1']);
    mockGetAllProcessedEmailIds.mockResolvedValue([]);
    mockIsEmailProcessed.mockResolvedValue(false);
    mockGetEmailDetails.mockResolvedValue({
      subject: 'Licitacion Test',
      date: '2025-03-01',
      attachments: [
        { filename: 'pliego.pdf', base64Data: 'base64data' },
      ],
    });
    mockExtractLicitacionData.mockResolvedValue({
      title: 'Test Project',
      location: 'San Juan',
      description: 'A test project',
      summary: 'Summary',
      category: 'obras',
      priority: 'high',
      confidence: 85,
      siteVisitDate: '03/20/2025',
      siteVisitTime: '10:00 AM',
      visitLocation: 'San Juan Office',
      contactName: 'Juan',
      contactPhone: '787-555-1234',
      biddingCloseDate: '04/15/2025',
      biddingCloseTime: '2:00 PM',
      estimatedValue: '$100,000',
    });
    mockUploadPdf.mockResolvedValue({ publicUrl: 'https://example.com/pliego.pdf' });
    mockUpsertLicitacion.mockResolvedValue({ rowNumber: 2 });
    mockMarkEmailAsProcessed.mockResolvedValue(undefined);
    mockMarkAsRead.mockResolvedValue(undefined);

    const request = createMockNextRequest('http://localhost:3000/api/cron/process-emails', {
      headers: { authorization: 'Bearer test-secret' },
    });
    const result = await GET(request);
    const data = await result.json();

    expect(result.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.stats.processed).toBe(1);
    expect(data.stats.emailsFound).toBe(1);
    expect(mockExtractLicitacionData).toHaveBeenCalledWith('base64data', 'pliego.pdf');
    expect(mockUploadPdf).toHaveBeenCalled();
    expect(mockUpsertLicitacion).toHaveBeenCalled();
    expect(mockMarkEmailAsProcessed).toHaveBeenCalled();
    expect(mockMarkAsRead).toHaveBeenCalled();
  });

  it('skips already-processed emails', async () => {
    mockSearchLicitacionEmails.mockResolvedValue(['msg-1', 'msg-2']);
    mockGetAllProcessedEmailIds.mockResolvedValue(['msg-1']);
    mockIsEmailProcessed.mockResolvedValue(false);
    mockGetEmailDetails.mockResolvedValue({
      subject: 'Test',
      date: '2025-03-01',
      attachments: [{ filename: 'pliego.pdf', base64Data: 'base64data' }],
    });
    mockExtractLicitacionData.mockResolvedValue({
      title: 'Test', location: 'SJ', description: 'Desc', summary: 'Sum',
      category: 'obras', priority: 'high', confidence: 85,
      siteVisitDate: '03/20/2025', siteVisitTime: '10:00 AM',
      visitLocation: 'SJ', contactName: 'J', contactPhone: '787-555-1234',
      biddingCloseDate: '04/15/2025', biddingCloseTime: '2:00 PM', estimatedValue: '$100,000',
    });
    mockUploadPdf.mockResolvedValue({ publicUrl: 'https://example.com/pdf' });
    mockUpsertLicitacion.mockResolvedValue({ rowNumber: 2 });
    mockMarkEmailAsProcessed.mockResolvedValue(undefined);
    mockMarkAsRead.mockResolvedValue(undefined);

    const request = createMockNextRequest('http://localhost:3000/api/cron/process-emails', {
      headers: { authorization: 'Bearer test-secret' },
    });
    const result = await GET(request);
    const data = await result.json();

    expect(data.stats.alreadyProcessed).toBe(1);
    expect(data.stats.processed).toBe(1);
  });

  it('skips emails with no attachments', async () => {
    mockSearchLicitacionEmails.mockResolvedValue(['msg-1']);
    mockGetAllProcessedEmailIds.mockResolvedValue([]);
    mockIsEmailProcessed.mockResolvedValue(false);
    mockGetEmailDetails.mockResolvedValue({
      subject: 'No Attachments',
      date: '2025-03-01',
      attachments: [],
    });

    const request = createMockNextRequest('http://localhost:3000/api/cron/process-emails', {
      headers: { authorization: 'Bearer test-secret' },
    });
    const result = await GET(request);
    const data = await result.json();

    expect(data.stats.skippedNoAttachments).toBe(1);
    expect(data.stats.processed).toBe(0);
  });

  it('skips closed biddings and still marks as processed', async () => {
    const { isBiddingOpen } = await import('@/lib/services/cron.utils');
    (isBiddingOpen as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);

    mockSearchLicitacionEmails.mockResolvedValue(['msg-1']);
    mockGetAllProcessedEmailIds.mockResolvedValue([]);
    mockIsEmailProcessed.mockResolvedValue(false);
    mockGetEmailDetails.mockResolvedValue({
      subject: 'Closed Bid',
      date: '2025-03-01',
      attachments: [{ filename: 'pliego.pdf', base64Data: 'base64data' }],
    });
    mockExtractLicitacionData.mockResolvedValue({
      title: 'Test', location: 'SJ', description: 'Desc', summary: 'Sum',
      category: 'obras', priority: 'high', confidence: 85,
      siteVisitDate: 'No disponible', siteVisitTime: 'No disponible',
      visitLocation: 'No disponible', contactName: 'J', contactPhone: '787-555-1234',
      biddingCloseDate: '01/01/2025', biddingCloseTime: '2:00 PM', estimatedValue: 'No disponible',
    });
    mockMarkEmailAsProcessed.mockResolvedValue(undefined);

    const request = createMockNextRequest('http://localhost:3000/api/cron/process-emails', {
      headers: { authorization: 'Bearer test-secret' },
    });
    const result = await GET(request);
    const data = await result.json();

    expect(data.stats.skippedClosed).toBe(1);
    expect(data.stats.processed).toBe(0);
    expect(mockMarkEmailAsProcessed).toHaveBeenCalled();
    expect(mockUploadPdf).not.toHaveBeenCalled();
  });

  it('allows request without CRON_SECRET env var', async () => {
    delete process.env.CRON_SECRET;
    mockSearchLicitacionEmails.mockResolvedValue([]);

    const request = createMockNextRequest('http://localhost:3000/api/cron/process-emails');
    const result = await GET(request);
    const data = await result.json();

    expect(result.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('skips duplicate email found during processing', async () => {
    mockSearchLicitacionEmails.mockResolvedValue(['msg-1']);
    mockGetAllProcessedEmailIds.mockResolvedValue([]);
    mockIsEmailProcessed.mockResolvedValue(true); // double-check returns true

    const request = createMockNextRequest('http://localhost:3000/api/cron/process-emails', {
      headers: { authorization: 'Bearer test-secret' },
    });
    const result = await GET(request);
    const data = await result.json();

    expect(data.stats.alreadyProcessed).toBe(1);
    expect(data.stats.processed).toBe(0);
  });

  it('handles individual email processing error', async () => {
    mockSearchLicitacionEmails.mockResolvedValue(['msg-1']);
    mockGetAllProcessedEmailIds.mockResolvedValue([]);
    mockIsEmailProcessed.mockResolvedValue(false);
    mockGetEmailDetails.mockRejectedValue(new Error('Email fetch failed'));

    const request = createMockNextRequest('http://localhost:3000/api/cron/process-emails', {
      headers: { authorization: 'Bearer test-secret' },
    });
    const result = await GET(request);
    const data = await result.json();

    expect(data.stats.errors).toBe(1);
    expect(data.stats.processed).toBe(0);
  });

  it('handles errors gracefully', async () => {
    mockSearchLicitacionEmails.mockRejectedValue(new Error('Gmail API error'));

    const request = createMockNextRequest('http://localhost:3000/api/cron/process-emails', {
      headers: { authorization: 'Bearer test-secret' },
    });
    const result = await GET(request);
    const data = await result.json();

    expect(result.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Gmail API error');
  });
});
