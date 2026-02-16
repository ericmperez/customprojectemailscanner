// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────

const mockExtractLicitacionData = vi.hoisted(() => vi.fn());
const mockIsEmailProcessed = vi.hoisted(() => vi.fn());
const mockMarkEmailAsProcessed = vi.hoisted(() => vi.fn());
const mockUploadPdf = vi.hoisted(() => vi.fn());
const mockGetAllProcessedEmailIds = vi.hoisted(() => vi.fn());
const mockIsBiddingOpen = vi.hoisted(() => vi.fn());
const mockIsMinutaOrAsistencia = vi.hoisted(() => vi.fn());
const mockSaveLicitacion = vi.hoisted(() => vi.fn());

// ── Module mocks ──────────────────────────────────────────────────────

vi.mock('@/lib/services/gmail.service', () => ({
  default: vi.fn(),
}));

vi.mock('@/lib/services/licitaciones.service', () => {
  return {
    default: class MockLicitacionesService {
      saveLicitacion = mockSaveLicitacion;
    },
  };
});

vi.mock('@/lib/services/openai.service', () => ({
  extractLicitacionData: mockExtractLicitacionData,
}));

vi.mock('@/lib/services/supabase.service', () => ({
  isEmailProcessed: mockIsEmailProcessed,
  markEmailAsProcessed: mockMarkEmailAsProcessed,
  uploadPdf: mockUploadPdf,
  getAllProcessedEmailIds: mockGetAllProcessedEmailIds,
}));

vi.mock('@/lib/services/cron.utils', () => ({
  isBiddingOpen: mockIsBiddingOpen,
  isMinutaOrAsistencia: mockIsMinutaOrAsistencia,
}));

import { processNewEmails } from '@/lib/services/email-processor';

// ── Test data ─────────────────────────────────────────────────────────

const mockEmail = {
  subject: 'Licitación 001',
  date: '2025-03-01',
  bodyText: 'Visit https://subastas.gobierno.pr/bid/123 for details',
  attachments: [
    {
      filename: 'BID001.PDF',
      base64Data: 'base64data',
      mimeType: 'application/pdf',
    },
  ],
};

const mockExtracted = {
  title: 'Mantenimiento AC',
  location: 'San Juan',
  description: 'Desc',
  summary: 'Summary',
  category: 'Mantenimiento',
  priority: 'Medium',
  siteVisitDate: '03/15/2025',
  siteVisitTime: '10:00',
  visitLocation: 'EBAS San Juan',
  visitRequirements: 'N/A',
  contactName: 'Juan',
  contactPhone: '(787) 555-1234',
  biddingCloseDate: '03/30/2025',
  biddingCloseTime: '14:00',
  estimatedValue: '$45,000',
  confidence: 85,
};

const createMockGmail = () => ({
  searchLicitacionEmails: vi.fn(),
  getEmailDetails: vi.fn(),
  markAsRead: vi.fn(),
});

// ── Tests ─────────────────────────────────────────────────────────────

describe('processNewEmails', () => {
  let mockGmail: ReturnType<typeof createMockGmail>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGmail = createMockGmail();

    // Defaults: nothing processed yet, bidding is open, no minutas
    mockGetAllProcessedEmailIds.mockResolvedValue([]);
    mockIsEmailProcessed.mockResolvedValue(false);
    mockIsBiddingOpen.mockReturnValue(true);
    mockIsMinutaOrAsistencia.mockReturnValue(false);
    mockMarkEmailAsProcessed.mockResolvedValue(undefined);
    mockUploadPdf.mockResolvedValue({ publicUrl: 'https://storage.test/pdf.pdf' });
    mockSaveLicitacion.mockResolvedValue({ id: 'row-1' });
    mockExtractLicitacionData.mockResolvedValue(mockExtracted);
    mockGmail.getEmailDetails.mockResolvedValue(mockEmail);
    mockGmail.markAsRead.mockResolvedValue(undefined);
  });

  it('returns empty stats when no emails found', async () => {
    mockGmail.searchLicitacionEmails.mockResolvedValue([]);

    const stats = await processNewEmails('org-1', Date.now(), 7, mockGmail as never);

    expect(stats.emailsFound).toBe(0);
    expect(stats.processed).toBe(0);
    expect(stats.errors).toBe(0);
  });

  it('filters out already-processed emails via processedIds Set', async () => {
    mockGmail.searchLicitacionEmails.mockResolvedValue(['msg-1', 'msg-2', 'msg-3']);
    mockGetAllProcessedEmailIds.mockResolvedValue(['msg-1', 'msg-3']);

    const stats = await processNewEmails('org-1', Date.now(), 7, mockGmail as never);

    expect(stats.emailsFound).toBe(3);
    expect(stats.alreadyProcessed).toBe(2); // 2 filtered out
    // Only msg-2 should be processed
    expect(mockGmail.getEmailDetails).toHaveBeenCalledTimes(1);
    expect(mockGmail.getEmailDetails).toHaveBeenCalledWith('msg-2');
  });

  it('skips emails with only minuta attachments', async () => {
    mockGmail.searchLicitacionEmails.mockResolvedValue(['msg-1']);
    mockIsMinutaOrAsistencia.mockReturnValue(true);

    const stats = await processNewEmails('org-1', Date.now(), 7, mockGmail as never);

    expect(stats.skippedMinuta).toBeGreaterThanOrEqual(1);
    expect(stats.skippedNoAttachments).toBe(1);
    expect(stats.processed).toBe(0);
  });

  it('skips emails with no valid PDF attachments', async () => {
    mockGmail.searchLicitacionEmails.mockResolvedValue(['msg-1']);
    mockGmail.getEmailDetails.mockResolvedValue({
      ...mockEmail,
      attachments: [], // no attachments at all
    });

    const stats = await processNewEmails('org-1', Date.now(), 7, mockGmail as never);

    expect(stats.skippedNoAttachments).toBe(1);
    expect(stats.processed).toBe(0);
  });

  it('skips closed bidding emails', async () => {
    mockGmail.searchLicitacionEmails.mockResolvedValue(['msg-1']);
    mockIsBiddingOpen.mockReturnValue(false);

    const stats = await processNewEmails('org-1', Date.now(), 7, mockGmail as never);

    expect(stats.skippedClosed).toBe(1);
    expect(stats.processed).toBe(0);
    // Should still mark as processed to avoid re-checking
    expect(mockMarkEmailAsProcessed).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({
        email_id: 'msg-1',
        description: expect.stringContaining('Skipped - bidding closed'),
      })
    );
  });

  it('successfully processes a valid email end-to-end', async () => {
    mockGmail.searchLicitacionEmails.mockResolvedValue(['msg-1']);

    const stats = await processNewEmails('org-1', Date.now(), 7, mockGmail as never);

    expect(stats.processed).toBe(1);
    expect(stats.errors).toBe(0);

    // Verify extraction was called with the PDF data
    expect(mockExtractLicitacionData).toHaveBeenCalledWith(
      'base64data',
      'BID001.PDF',
      'msg-1',
      'org-1'
    );

    // Verify PDF was uploaded
    expect(mockUploadPdf).toHaveBeenCalledWith(
      'org-1',
      'base64data',
      'BID001.PDF',
      'msg-1'
    );

    // Verify licitacion was saved with extracted data
    expect(mockSaveLicitacion).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({
        title: 'Mantenimiento AC',
        location: 'San Juan',
        emailId: 'msg-1',
        pdfFilename: 'BID001.PDF',
        approvalStatus: 'pending',
      })
    );

    // Verify email was marked as processed and read
    expect(mockMarkEmailAsProcessed).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({
        email_id: 'msg-1',
        subject: 'Licitación 001',
      })
    );
    expect(mockGmail.markAsRead).toHaveBeenCalledWith('msg-1');
  });

  it('respects maxEmails limit', async () => {
    mockGmail.searchLicitacionEmails.mockResolvedValue([
      'msg-1',
      'msg-2',
      'msg-3',
      'msg-4',
      'msg-5',
    ]);

    const stats = await processNewEmails('org-1', Date.now(), 2, mockGmail as never);

    // Only 2 emails should have been fetched for details
    expect(mockGmail.getEmailDetails).toHaveBeenCalledTimes(2);
    expect(stats.processed).toBe(2);
  });

  it('handles errors gracefully and continues processing', async () => {
    mockGmail.searchLicitacionEmails.mockResolvedValue(['msg-1', 'msg-2']);
    mockGmail.getEmailDetails
      .mockRejectedValueOnce(new Error('Gmail API timeout'))
      .mockResolvedValueOnce(mockEmail);

    const stats = await processNewEmails('org-1', Date.now(), 7, mockGmail as never);

    expect(stats.errors).toBe(1);
    expect(stats.processed).toBe(1);
    expect(stats.details).toContainEqual(expect.stringContaining('Gmail API timeout'));
  });

  it('falls back to email subject when title is generic', async () => {
    mockGmail.searchLicitacionEmails.mockResolvedValue(['msg-1']);
    mockExtractLicitacionData.mockResolvedValue({
      ...mockExtracted,
      title: 'Certificación de Recibo de Pliegos',
    });
    mockGmail.getEmailDetails.mockResolvedValue({
      ...mockEmail,
      subject: 'INVITACION-Proyecto Mantenimiento HVAC',
    });

    const stats = await processNewEmails('org-1', Date.now(), 7, mockGmail as never);

    expect(stats.processed).toBe(1);
    expect(mockSaveLicitacion).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({
        title: 'Proyecto Mantenimiento HVAC',
      })
    );
  });

  it('time budget check stops processing early', async () => {
    mockGmail.searchLicitacionEmails.mockResolvedValue(['msg-1', 'msg-2', 'msg-3']);

    // Use a startTime far in the past so budget is already exceeded
    const expiredStart = Date.now() - 60_000; // 60 seconds ago, well past 45s budget

    const stats = await processNewEmails('org-1', expiredStart, 7, mockGmail as never);

    // Should not process any emails since time budget is already exceeded
    expect(mockGmail.getEmailDetails).not.toHaveBeenCalled();
    expect(stats.processed).toBe(0);
    expect(stats.details).toContainEqual(expect.stringContaining('time budget'));
  });

  it('extracts quote URL from email body', async () => {
    mockGmail.searchLicitacionEmails.mockResolvedValue(['msg-1']);

    const stats = await processNewEmails('org-1', Date.now(), 7, mockGmail as never);

    expect(stats.processed).toBe(1);
    expect(mockSaveLicitacion).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({
        quoteUrl: 'https://subastas.gobierno.pr/bid/123',
      })
    );
  });

  it('sets isEmergency flag when subject contains "emergencia"', async () => {
    mockGmail.searchLicitacionEmails.mockResolvedValue(['msg-1']);
    mockGmail.getEmailDetails.mockResolvedValue({
      ...mockEmail,
      subject: 'EMERGENCIA - Reparación tubería San Juan',
    });

    const stats = await processNewEmails('org-1', Date.now(), 7, mockGmail as never);

    expect(stats.processed).toBe(1);
    expect(mockSaveLicitacion).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({
        isEmergency: true,
      })
    );
  });

  it('skips email on double-check dedup (race condition)', async () => {
    mockGmail.searchLicitacionEmails.mockResolvedValue(['msg-1']);
    // getAllProcessedEmailIds says not processed, but isEmailProcessed says yes (race)
    mockIsEmailProcessed.mockResolvedValue(true);

    const stats = await processNewEmails('org-1', Date.now(), 7, mockGmail as never);

    expect(stats.alreadyProcessed).toBe(1); // incremented from double-check
    expect(stats.processed).toBe(0);
    expect(mockGmail.getEmailDetails).not.toHaveBeenCalled();
  });

  it('processes all emails when maxEmails is 0 (unlimited)', async () => {
    mockGmail.searchLicitacionEmails.mockResolvedValue([
      'msg-1',
      'msg-2',
      'msg-3',
      'msg-4',
    ]);

    const stats = await processNewEmails('org-1', Date.now(), 0, mockGmail as never);

    expect(mockGmail.getEmailDetails).toHaveBeenCalledTimes(4);
    expect(stats.processed).toBe(4);
  });
});
