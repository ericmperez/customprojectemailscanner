// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockNextRequest } from '@/__tests__/helpers';

const {
  mockGetOrgDbId,
  mockGetUserName,
  mockGetChecklist,
  mockInitializeChecklist,
  mockToggleChecklistItem,
  mockAddChecklistItem,
  mockDeleteChecklistItem,
  mockLogActivity,
} = vi.hoisted(() => ({
  mockGetOrgDbId: vi.fn(),
  mockGetUserName: vi.fn(),
  mockGetChecklist: vi.fn(),
  mockInitializeChecklist: vi.fn(),
  mockToggleChecklistItem: vi.fn(),
  mockAddChecklistItem: vi.fn(),
  mockDeleteChecklistItem: vi.fn(),
  mockLogActivity: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getOrgDbId: (...args: unknown[]) => mockGetOrgDbId(...args),
  getUserName: (...args: unknown[]) => mockGetUserName(...args),
}));

vi.mock('@/lib/services/supabase.service', () => ({
  getChecklist: (...args: unknown[]) => mockGetChecklist(...args),
  initializeChecklist: (...args: unknown[]) => mockInitializeChecklist(...args),
  toggleChecklistItem: (...args: unknown[]) => mockToggleChecklistItem(...args),
  addChecklistItem: (...args: unknown[]) => mockAddChecklistItem(...args),
  deleteChecklistItem: (...args: unknown[]) => mockDeleteChecklistItem(...args),
  logActivity: (...args: unknown[]) => mockLogActivity(...args),
}));

import { GET, PATCH, POST, DELETE } from '@/app/api/licitaciones/[id]/checklist/route';

const ORG_ID = 'org-uuid-123';
const LIC_ID = 'lic-uuid-456';
const params = Promise.resolve({ id: LIC_ID });

describe('/api/licitaciones/[id]/checklist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOrgDbId.mockResolvedValue(ORG_ID);
    mockGetUserName.mockResolvedValue('Eric');
  });

  describe('GET', () => {
    it('returns existing checklist items', async () => {
      const items = [
        { id: '1', label: 'Revisar documentos', completed: false, completed_by: null, completed_at: null, sort_order: 0 },
        { id: '2', label: 'Cotizar materiales', completed: true, completed_by: 'Eric', completed_at: '2026-01-01T00:00:00Z', sort_order: 1 },
      ];
      mockGetChecklist.mockResolvedValue(items);

      const request = createMockNextRequest(`http://localhost:3000/api/licitaciones/${LIC_ID}/checklist`);
      const result = await GET(request, { params });
      const data = await result.json();

      expect(result.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(items);
      expect(mockGetChecklist).toHaveBeenCalledWith(ORG_ID, LIC_ID);
      expect(mockInitializeChecklist).not.toHaveBeenCalled();
    });

    it('initializes default checklist when none exist', async () => {
      const defaultItems = [
        { id: '1', label: 'Revisar documentos', completed: false, completed_by: null, completed_at: null, sort_order: 0 },
      ];
      mockGetChecklist.mockResolvedValue([]);
      mockInitializeChecklist.mockResolvedValue(defaultItems);

      const request = createMockNextRequest(`http://localhost:3000/api/licitaciones/${LIC_ID}/checklist`);
      const result = await GET(request, { params });
      const data = await result.json();

      expect(data.success).toBe(true);
      expect(data.data).toEqual(defaultItems);
      expect(mockInitializeChecklist).toHaveBeenCalledWith(ORG_ID, LIC_ID);
    });

    it('returns 500 on error', async () => {
      mockGetOrgDbId.mockRejectedValue(new Error('Auth error'));

      const request = createMockNextRequest(`http://localhost:3000/api/licitaciones/${LIC_ID}/checklist`);
      const result = await GET(request, { params });
      const data = await result.json();

      expect(result.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  describe('PATCH', () => {
    it('toggles item to completed', async () => {
      const updated = { id: 'item-1', label: 'Revisar documentos', completed: true, completed_by: 'Eric', completed_at: '2026-01-01T00:00:00Z', sort_order: 0 };
      mockToggleChecklistItem.mockResolvedValue(updated);

      const request = createMockNextRequest(`http://localhost:3000/api/licitaciones/${LIC_ID}/checklist`, {
        method: 'PATCH',
        body: { itemId: 'item-1', completed: true },
      });
      const result = await PATCH(request, { params });
      const data = await result.json();

      expect(data.success).toBe(true);
      expect(data.data).toEqual(updated);
      expect(mockToggleChecklistItem).toHaveBeenCalledWith(ORG_ID, 'item-1', true, 'Eric');
      expect(mockLogActivity).toHaveBeenCalledWith(ORG_ID, 'checklist_toggle', LIC_ID, null, 'Eric', {
        label: 'Revisar documentos',
        completed: true,
      });
    });

    it('toggles item to uncompleted', async () => {
      const updated = { id: 'item-1', label: 'Revisar documentos', completed: false, completed_by: null, completed_at: null, sort_order: 0 };
      mockToggleChecklistItem.mockResolvedValue(updated);

      const request = createMockNextRequest(`http://localhost:3000/api/licitaciones/${LIC_ID}/checklist`, {
        method: 'PATCH',
        body: { itemId: 'item-1', completed: false },
      });
      const result = await PATCH(request, { params });
      const data = await result.json();

      expect(data.success).toBe(true);
      expect(data.data).toEqual(updated);
    });

    it('returns 400 when itemId is missing', async () => {
      const request = createMockNextRequest(`http://localhost:3000/api/licitaciones/${LIC_ID}/checklist`, {
        method: 'PATCH',
        body: { completed: true },
      });
      const result = await PATCH(request, { params });
      const data = await result.json();

      expect(result.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('returns 400 when completed is not boolean', async () => {
      const request = createMockNextRequest(`http://localhost:3000/api/licitaciones/${LIC_ID}/checklist`, {
        method: 'PATCH',
        body: { itemId: 'item-1', completed: 'yes' },
      });
      const result = await PATCH(request, { params });
      const data = await result.json();

      expect(result.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('returns 500 on service error', async () => {
      mockToggleChecklistItem.mockRejectedValue(new Error('DB error'));

      const request = createMockNextRequest(`http://localhost:3000/api/licitaciones/${LIC_ID}/checklist`, {
        method: 'PATCH',
        body: { itemId: 'item-1', completed: true },
      });
      const result = await PATCH(request, { params });
      const data = await result.json();

      expect(result.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  describe('POST', () => {
    it('adds a new checklist item', async () => {
      const created = { id: 'new-1', label: 'Nuevo paso', completed: false, completed_by: null, completed_at: null, sort_order: 5 };
      mockAddChecklistItem.mockResolvedValue(created);

      const request = createMockNextRequest(`http://localhost:3000/api/licitaciones/${LIC_ID}/checklist`, {
        method: 'POST',
        body: { label: 'Nuevo paso' },
      });
      const result = await POST(request, { params });
      const data = await result.json();

      expect(data.success).toBe(true);
      expect(data.data).toEqual(created);
      expect(mockAddChecklistItem).toHaveBeenCalledWith(ORG_ID, LIC_ID, 'Nuevo paso');
    });

    it('trims whitespace from label', async () => {
      const created = { id: 'new-1', label: 'Nuevo paso', completed: false, completed_by: null, completed_at: null, sort_order: 5 };
      mockAddChecklistItem.mockResolvedValue(created);

      const request = createMockNextRequest(`http://localhost:3000/api/licitaciones/${LIC_ID}/checklist`, {
        method: 'POST',
        body: { label: '  Nuevo paso  ' },
      });
      const result = await POST(request, { params });

      expect(mockAddChecklistItem).toHaveBeenCalledWith(ORG_ID, LIC_ID, 'Nuevo paso');
    });

    it('returns 400 for empty label', async () => {
      const request = createMockNextRequest(`http://localhost:3000/api/licitaciones/${LIC_ID}/checklist`, {
        method: 'POST',
        body: { label: '   ' },
      });
      const result = await POST(request, { params });
      const data = await result.json();

      expect(result.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('label is required');
    });

    it('returns 400 for missing label', async () => {
      const request = createMockNextRequest(`http://localhost:3000/api/licitaciones/${LIC_ID}/checklist`, {
        method: 'POST',
        body: {},
      });
      const result = await POST(request, { params });
      const data = await result.json();

      expect(result.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('returns 500 on service error', async () => {
      mockAddChecklistItem.mockRejectedValue(new Error('DB error'));

      const request = createMockNextRequest(`http://localhost:3000/api/licitaciones/${LIC_ID}/checklist`, {
        method: 'POST',
        body: { label: 'Test' },
      });
      const result = await POST(request, { params });
      const data = await result.json();

      expect(result.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  describe('DELETE', () => {
    it('deletes a checklist item', async () => {
      mockDeleteChecklistItem.mockResolvedValue(undefined);

      const request = createMockNextRequest(`http://localhost:3000/api/licitaciones/${LIC_ID}/checklist`, {
        method: 'DELETE',
        body: { itemId: 'item-1' },
      });
      const result = await DELETE(request, { params });
      const data = await result.json();

      expect(data.success).toBe(true);
      expect(mockDeleteChecklistItem).toHaveBeenCalledWith(ORG_ID, 'item-1');
    });

    it('returns 400 when itemId is missing', async () => {
      const request = createMockNextRequest(`http://localhost:3000/api/licitaciones/${LIC_ID}/checklist`, {
        method: 'DELETE',
        body: {},
      });
      const result = await DELETE(request, { params });
      const data = await result.json();

      expect(result.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('itemId is required');
    });

    it('returns 500 on service error', async () => {
      mockDeleteChecklistItem.mockRejectedValue(new Error('DB error'));

      const request = createMockNextRequest(`http://localhost:3000/api/licitaciones/${LIC_ID}/checklist`, {
        method: 'DELETE',
        body: { itemId: 'item-1' },
      });
      const result = await DELETE(request, { params });
      const data = await result.json();

      expect(result.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });
});
