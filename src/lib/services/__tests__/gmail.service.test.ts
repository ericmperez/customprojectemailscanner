import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock googleapis ─────────────────────────────────────────────────────
const mockList = vi.fn();
const mockGet = vi.fn();
const mockModify = vi.fn();
const mockAttachmentsGet = vi.fn();

vi.mock('googleapis', () => {
  class MockOAuth2 {
    setCredentials = vi.fn();
  }
  return {
    google: {
      auth: {
        OAuth2: MockOAuth2,
      },
      gmail: vi.fn(() => ({
        users: {
          messages: {
            list: mockList,
            get: mockGet,
            modify: mockModify,
            attachments: { get: mockAttachmentsGet },
          },
        },
      })),
    },
  };
});

// ── Mock retry ──────────────────────────────────────────────────────────
vi.mock('@/lib/utils/retry', () => ({
  withRetry: vi.fn((fn: () => unknown) => fn()),
}));

import GmailService from '@/lib/services/gmail.service';

describe('GmailService', () => {
  let service: GmailService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GmailService();
  });

  // ── searchLicitacionEmails ──────────────────────────────────────────

  describe('searchLicitacionEmails', () => {
    it('returns message IDs from search results', async () => {
      mockList.mockResolvedValue({
        data: {
          messages: [{ id: 'msg-1' }, { id: 'msg-2' }],
          nextPageToken: undefined,
        },
      });

      const ids = await service.searchLicitacionEmails();

      expect(ids).toEqual(['msg-1', 'msg-2']);
      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'me',
          maxResults: 100,
        })
      );
    });

    it('handles pagination with nextPageToken', async () => {
      mockList
        .mockResolvedValueOnce({
          data: {
            messages: [{ id: 'msg-1' }],
            nextPageToken: 'token-page2',
          },
        })
        .mockResolvedValueOnce({
          data: {
            messages: [{ id: 'msg-2' }],
            nextPageToken: undefined,
          },
        });

      const ids = await service.searchLicitacionEmails();

      expect(ids).toEqual(['msg-1', 'msg-2']);
      expect(mockList).toHaveBeenCalledTimes(2);
    });

    it('returns empty array when no messages found', async () => {
      mockList.mockResolvedValue({
        data: { messages: undefined, nextPageToken: undefined },
      });

      const ids = await service.searchLicitacionEmails();
      expect(ids).toEqual([]);
    });

    it('includes afterDate in query when provided', async () => {
      mockList.mockResolvedValue({
        data: { messages: [], nextPageToken: undefined },
      });

      await service.searchLicitacionEmails(new Date(2025, 0, 15));

      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({
          q: expect.stringContaining('after:2025/01/15'),
        })
      );
    });
  });

  // ── getEmailDetails ─────────────────────────────────────────────────

  describe('getEmailDetails', () => {
    it('returns email details with subject, from, and date', async () => {
      mockGet.mockResolvedValue({
        data: {
          id: 'msg-1',
          payload: {
            headers: [
              { name: 'Subject', value: 'Licitacion Test' },
              { name: 'From', value: 'sender@test.com' },
              { name: 'Date', value: 'Mon, 15 Jan 2025 10:00:00 GMT' },
            ],
            parts: [],
          },
        },
      });

      const details = await service.getEmailDetails('msg-1');

      expect(details.id).toBe('msg-1');
      expect(details.subject).toBe('Licitacion Test');
      expect(details.from).toBe('sender@test.com');
      expect(details.date).toBe('Mon, 15 Jan 2025 10:00:00 GMT');
      expect(details.attachments).toEqual([]);
    });

    it('extracts PDF attachments from message parts', async () => {
      mockGet.mockResolvedValue({
        data: {
          id: 'msg-2',
          payload: {
            headers: [
              { name: 'Subject', value: 'With PDF' },
              { name: 'From', value: 'a@b.com' },
              { name: 'Date', value: 'date-str' },
            ],
            parts: [
              {
                mimeType: 'application/pdf',
                filename: 'doc.pdf',
                body: { attachmentId: 'att-1', size: 1024 },
              },
            ],
          },
        },
      });

      mockAttachmentsGet.mockResolvedValue({
        data: { data: 'YmFzZTY0ZGF0YQ', size: 1024 },
      });

      const details = await service.getEmailDetails('msg-2');

      expect(details.attachments).toHaveLength(1);
      expect(details.attachments[0].filename).toBe('doc.pdf');
      expect(details.attachments[0].mimeType).toBe('application/pdf');
      expect(details.attachments[0].size).toBe(1024);
    });

    it('returns empty string for missing headers', async () => {
      mockGet.mockResolvedValue({
        data: {
          id: 'msg-3',
          payload: {
            headers: [],
            parts: [],
          },
        },
      });

      const details = await service.getEmailDetails('msg-3');
      expect(details.subject).toBe('');
      expect(details.from).toBe('');
    });
  });

  // ── markAsRead ──────────────────────────────────────────────────────

  describe('markAsRead', () => {
    it('calls modify with UNREAD removal', async () => {
      mockModify.mockResolvedValue({ data: {} });

      await service.markAsRead('msg-1');

      expect(mockModify).toHaveBeenCalledWith({
        userId: 'me',
        id: 'msg-1',
        requestBody: {
          removeLabelIds: ['UNREAD'],
        },
      });
    });
  });
});
