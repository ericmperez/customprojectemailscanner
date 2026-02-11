import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock chain helpers
const mockSingle = vi.fn();
const mockLimit = vi.fn();
const mockRange = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpsert = vi.fn();
const mockFrom = vi.fn();
const mockUpload = vi.fn();
const mockGetPublicUrl = vi.fn();
const mockStorageFrom = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
    storage: {
      from: mockStorageFrom,
    },
  })),
}));

// Set env vars before importing the module
process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_KEY = 'test-key';

import {
  isEmailProcessed,
  markEmailAsProcessed,
  uploadPdf,
  getAllProcessedEmailIds,
  getConfidenceSettings,
  saveConfidenceSettings,
} from '@/lib/services/supabase.service';

describe('supabase.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default chain: from() -> select/insert/upsert -> eq -> limit/single/range
    mockFrom.mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      upsert: mockUpsert,
    });
    mockSelect.mockReturnValue({
      eq: mockEq,
      range: mockRange,
    });
    mockEq.mockReturnValue({
      limit: mockLimit,
      single: mockSingle,
    });

    mockStorageFrom.mockReturnValue({
      upload: mockUpload,
      getPublicUrl: mockGetPublicUrl,
    });
  });

  // ── isEmailProcessed ──────────────────────────────────────────────────

  describe('isEmailProcessed', () => {
    it('returns true when email record exists', async () => {
      mockLimit.mockResolvedValue({ data: [{ id: 1 }], error: null });

      const result = await isEmailProcessed('email-123');

      expect(mockFrom).toHaveBeenCalledWith('processed_emails');
      expect(mockSelect).toHaveBeenCalledWith('id');
      expect(mockEq).toHaveBeenCalledWith('email_id', 'email-123');
      expect(mockLimit).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
    });

    it('returns false when no record found', async () => {
      mockLimit.mockResolvedValue({ data: [], error: null });

      const result = await isEmailProcessed('email-not-found');
      expect(result).toBe(false);
    });

    it('returns false when data is null', async () => {
      mockLimit.mockResolvedValue({ data: null, error: null });

      const result = await isEmailProcessed('email-null');
      expect(result).toBe(false);
    });

    it('returns false on query error', async () => {
      mockLimit.mockResolvedValue({ data: null, error: new Error('DB error') });

      const result = await isEmailProcessed('email-err');
      expect(result).toBe(false);
    });
  });

  // ── markEmailAsProcessed ──────────────────────────────────────────────

  describe('markEmailAsProcessed', () => {
    it('inserts a record into processed_emails', async () => {
      mockInsert.mockResolvedValue({ error: null });

      const record = {
        email_id: 'e1',
        subject: 'Test',
        location: 'San Juan',
        description: 'desc',
        pdf_filename: 'file.pdf',
      };

      await markEmailAsProcessed(record);

      expect(mockFrom).toHaveBeenCalledWith('processed_emails');
      expect(mockInsert).toHaveBeenCalledWith({
        email_id: 'e1',
        subject: 'Test',
        location: 'San Juan',
        description: 'desc',
        pdf_filename: 'file.pdf',
      });
    });

    it('throws on insert error', async () => {
      const dbError = new Error('insert failed');
      mockInsert.mockResolvedValue({ error: dbError });

      await expect(
        markEmailAsProcessed({
          email_id: 'e2',
          subject: 'S',
          location: 'L',
          description: 'D',
          pdf_filename: 'f.pdf',
        })
      ).rejects.toThrow('insert failed');
    });
  });

  // ── uploadPdf ─────────────────────────────────────────────────────────

  describe('uploadPdf', () => {
    it('uploads a PDF and returns path and publicUrl', async () => {
      mockUpload.mockResolvedValue({ error: null });
      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://storage.test/email-1/doc.pdf' },
      });

      const result = await uploadPdf('cGRmZGF0YQ==', 'doc.pdf', 'email-1');

      expect(mockStorageFrom).toHaveBeenCalledWith('licitaciones-pdfs');
      expect(mockUpload).toHaveBeenCalledWith(
        'email-1/doc.pdf',
        expect.any(Buffer),
        { contentType: 'application/pdf', upsert: true }
      );
      expect(result).toEqual({
        path: 'email-1/doc.pdf',
        publicUrl: 'https://storage.test/email-1/doc.pdf',
      });
    });

    it('throws on upload error', async () => {
      const uploadError = new Error('storage full');
      mockUpload.mockResolvedValue({ error: uploadError });

      await expect(uploadPdf('YmFzZTY0', 'fail.pdf', 'e2')).rejects.toThrow(
        'storage full'
      );
    });
  });

  // ── getAllProcessedEmailIds ────────────────────────────────────────────

  describe('getAllProcessedEmailIds', () => {
    it('returns all email ids in a single page', async () => {
      mockRange.mockResolvedValue({
        data: [{ email_id: 'a' }, { email_id: 'b' }],
        error: null,
      });

      const ids = await getAllProcessedEmailIds();

      expect(mockFrom).toHaveBeenCalledWith('processed_emails');
      expect(mockSelect).toHaveBeenCalledWith('email_id');
      expect(ids).toEqual(['a', 'b']);
    });

    it('paginates when first page is full (1000 items)', async () => {
      const page1 = Array.from({ length: 1000 }, (_, i) => ({
        email_id: `id-${i}`,
      }));
      const page2 = [{ email_id: 'id-1000' }, { email_id: 'id-1001' }];

      mockRange
        .mockResolvedValueOnce({ data: page1, error: null })
        .mockResolvedValueOnce({ data: page2, error: null });

      const ids = await getAllProcessedEmailIds();
      expect(ids).toHaveLength(1002);
      expect(mockRange).toHaveBeenCalledTimes(2);
      expect(mockRange).toHaveBeenCalledWith(0, 999);
      expect(mockRange).toHaveBeenCalledWith(1000, 1999);
    });

    it('returns empty array on error', async () => {
      mockRange.mockResolvedValue({ data: null, error: new Error('timeout') });

      const ids = await getAllProcessedEmailIds();
      expect(ids).toEqual([]);
    });

    it('returns empty array when data is empty', async () => {
      mockRange.mockResolvedValue({ data: [], error: null });

      const ids = await getAllProcessedEmailIds();
      expect(ids).toEqual([]);
    });
  });

  // ── getConfidenceSettings ─────────────────────────────────────────────

  describe('getConfidenceSettings', () => {
    it('returns stored settings when available', async () => {
      const settings = {
        critical: ['location'],
        optional: ['title'],
        ignored: [],
      };
      mockSingle.mockResolvedValue({ data: { value: settings }, error: null });

      const result = await getConfidenceSettings();
      expect(result).toEqual(settings);
    });

    it('returns default settings on query error', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: new Error('not found'),
      });

      const result = await getConfidenceSettings();
      expect(result.critical).toContain('location');
      expect(result.critical).toContain('description');
    });

    it('returns default settings when data is null', async () => {
      mockSingle.mockResolvedValue({ data: null, error: null });

      const result = await getConfidenceSettings();
      expect(result.critical).toContain('location');
    });
  });

  // ── saveConfidenceSettings ────────────────────────────────────────────

  describe('saveConfidenceSettings', () => {
    it('upserts settings to app_settings', async () => {
      mockUpsert.mockResolvedValue({ error: null });

      const settings = {
        critical: ['location' as const],
        optional: ['title' as const],
        ignored: [],
      };

      await saveConfidenceSettings(settings);

      expect(mockFrom).toHaveBeenCalledWith('app_settings');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'confidence_fields',
          value: settings,
        }),
        { onConflict: 'key' }
      );
    });

    it('throws on upsert error', async () => {
      const dbError = new Error('upsert failed');
      mockUpsert.mockResolvedValue({ error: dbError });

      await expect(
        saveConfidenceSettings({ critical: [], optional: [], ignored: [] })
      ).rejects.toThrow('upsert failed');
    });
  });
});
