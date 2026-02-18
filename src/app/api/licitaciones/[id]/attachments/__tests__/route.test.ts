// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetOrgDbId = vi.fn().mockResolvedValue('org-uuid-123');
const mockGetUserName = vi.fn().mockResolvedValue('Test User');
const mockGetAttachments = vi.fn();
const mockUploadAttachment = vi.fn();
const mockDeleteAttachment = vi.fn();
const mockLogActivity = vi.fn();

vi.mock('@/lib/auth', () => ({
  getOrgDbId: () => mockGetOrgDbId(),
  getUserName: () => mockGetUserName(),
}));

vi.mock('@/lib/services/supabase.service', () => ({
  getLicitacionAttachments: (...args: unknown[]) => mockGetAttachments(...args),
  uploadLicitacionAttachment: (...args: unknown[]) => mockUploadAttachment(...args),
  deleteLicitacionAttachment: (...args: unknown[]) => mockDeleteAttachment(...args),
  logActivity: (...args: unknown[]) => mockLogActivity(...args),
}));

import { GET, POST } from '../route';
import { DELETE } from '../[attachmentId]/route';

describe('GET /api/licitaciones/[id]/attachments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrgDbId.mockResolvedValue('org-uuid-123');
  });

  it('returns attachments list', async () => {
    const mockData = [
      { id: 'att-1', label: 'Quote', filename: 'quote.pdf', uploaded_by: 'Ana' },
    ];
    mockGetAttachments.mockResolvedValue(mockData);

    const request = new NextRequest(new URL('http://localhost:3000/api/licitaciones/abc/attachments'));
    const params = Promise.resolve({ id: 'abc' });
    const result = await GET(request, { params });
    const data = await result.json();

    expect(result.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(mockData);
    expect(mockGetAttachments).toHaveBeenCalledWith('org-uuid-123', 'abc');
  });

  it('returns 500 on error', async () => {
    mockGetOrgDbId.mockRejectedValue(new Error('Auth error'));

    const request = new NextRequest(new URL('http://localhost:3000/api/licitaciones/abc/attachments'));
    const params = Promise.resolve({ id: 'abc' });
    const result = await GET(request, { params });
    const data = await result.json();

    expect(result.status).toBe(500);
    expect(data.success).toBe(false);
  });
});

describe('POST /api/licitaciones/[id]/attachments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrgDbId.mockResolvedValue('org-uuid-123');
    mockGetUserName.mockResolvedValue('Test User');
  });

  it('uploads a file and returns attachment', async () => {
    const mockAttachment = {
      id: 'att-1',
      label: 'Quote',
      filename: 'quote.pdf',
      uploaded_by: 'Test User',
    };
    mockUploadAttachment.mockResolvedValue(mockAttachment);

    const formData = new FormData();
    formData.append('file', new File(['pdf content'], 'quote.pdf', { type: 'application/pdf' }));
    formData.append('label', 'Quote');

    const request = new NextRequest(
      new URL('http://localhost:3000/api/licitaciones/abc/attachments'),
      { method: 'POST', body: formData }
    );
    const params = Promise.resolve({ id: 'abc' });
    const result = await POST(request, { params });
    const data = await result.json();

    expect(result.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(mockAttachment);
    expect(mockUploadAttachment).toHaveBeenCalledWith(
      'org-uuid-123',
      'abc',
      'Quote',
      'quote.pdf',
      expect.any(Buffer),
      'application/pdf',
      'Test User'
    );
  });

  it('returns 400 when file is missing', async () => {
    const formData = new FormData();
    formData.append('label', 'Quote');

    const request = new NextRequest(
      new URL('http://localhost:3000/api/licitaciones/abc/attachments'),
      { method: 'POST', body: formData }
    );
    const params = Promise.resolve({ id: 'abc' });
    const result = await POST(request, { params });
    const data = await result.json();

    expect(result.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('file is required');
  });

  it('returns 400 when label is missing', async () => {
    const formData = new FormData();
    formData.append('file', new File(['content'], 'test.pdf', { type: 'application/pdf' }));

    const request = new NextRequest(
      new URL('http://localhost:3000/api/licitaciones/abc/attachments'),
      { method: 'POST', body: formData }
    );
    const params = Promise.resolve({ id: 'abc' });
    const result = await POST(request, { params });
    const data = await result.json();

    expect(result.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('label is required');
  });
});

describe('DELETE /api/licitaciones/[id]/attachments/[attachmentId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrgDbId.mockResolvedValue('org-uuid-123');
    mockGetUserName.mockResolvedValue('Test User');
  });

  it('deletes attachment and returns success', async () => {
    mockDeleteAttachment.mockResolvedValue(undefined);

    const request = new NextRequest(
      new URL('http://localhost:3000/api/licitaciones/abc/attachments/att-1'),
      { method: 'DELETE' }
    );
    const params = Promise.resolve({ id: 'abc', attachmentId: 'att-1' });
    const result = await DELETE(request, { params });
    const data = await result.json();

    expect(result.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDeleteAttachment).toHaveBeenCalledWith('org-uuid-123', 'att-1');
  });

  it('returns 500 on error', async () => {
    mockDeleteAttachment.mockRejectedValue(new Error('Not found'));

    const request = new NextRequest(
      new URL('http://localhost:3000/api/licitaciones/abc/attachments/att-1'),
      { method: 'DELETE' }
    );
    const params = Promise.resolve({ id: 'abc', attachmentId: 'att-1' });
    const result = await DELETE(request, { params });
    const data = await result.json();

    expect(result.status).toBe(500);
    expect(data.success).toBe(false);
  });
});
