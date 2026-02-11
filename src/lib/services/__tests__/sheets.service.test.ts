import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────
const mockValuesGet = vi.fn();
const mockValuesUpdate = vi.fn();
const mockValuesAppend = vi.fn();
const mockBatchUpdate = vi.fn();

vi.mock('googleapis', () => {
  class MockOAuth2 {
    setCredentials = vi.fn();
  }
  return {
    google: {
      auth: { OAuth2: MockOAuth2 },
      sheets: vi.fn(() => ({
        spreadsheets: {
          values: {
            get: mockValuesGet,
            update: mockValuesUpdate,
            append: mockValuesAppend,
          },
          batchUpdate: mockBatchUpdate,
        },
      })),
    },
  };
});

vi.mock('@/lib/utils/retry', () => ({
  withRetry: vi.fn((fn: () => unknown) => fn()),
}));

vi.mock('./visit-location.utils', () => ({
  normalizeVisitLocationLabel: vi.fn((v: string) => v || ''),
}));

import SheetsService from '@/lib/services/sheets.service';

// Headers matching the actual HEADERS array in sheets.service.ts
const HEADERS = [
  'Fecha de Procesamiento', 'Fecha del Email', 'Asunto', 'Ubicacion', 'Descripcion',
  'Resumen', 'Categoria', 'Prioridad', 'Archivo PDF', 'Ver PDF',
  'Fecha Site Visit', 'Hora Site Visit', 'Lugar de Visita', 'Nombre Contacto',
  'Telefono Contacto', 'Fecha Cierre Licitacion', 'Hora Cierre Licitacion',
  'Metodo Extraccion', 'Email ID', 'Approval Status', 'Approval Notes',
  'Interested', 'Decision Status', 'Titulo', 'Valor Estimado',
];

function makeRow(overrides: Partial<Record<string, string>> = {}): string[] {
  const defaults: Record<string, string> = {
    'Fecha de Procesamiento': '2025-03-01T10:00:00Z',
    'Fecha del Email': '2025-03-01',
    'Asunto': 'Test Subject',
    'Ubicacion': 'San Juan',
    'Descripcion': 'Test description',
    'Resumen': 'Test summary',
    'Categoria': 'Mantenimiento',
    'Prioridad': 'Medium',
    'Archivo PDF': 'test.pdf',
    'Ver PDF': '=HYPERLINK("https://example.com/pdf","Ver PDF")',
    'Fecha Site Visit': '2025-03-15',
    'Hora Site Visit': '10:00 AM',
    'Lugar de Visita': 'EBAS Torrecilla',
    'Nombre Contacto': 'Juan Pérez',
    'Telefono Contacto': '(787) 555-1234',
    'Fecha Cierre Licitacion': '2025-03-30',
    'Hora Cierre Licitacion': '02:00 PM',
    'Metodo Extraccion': 'GPT-4o (85%)',
    'Email ID': 'msg-1',
    'Approval Status': 'pending',
    'Approval Notes': '',
    'Interested': 'FALSE',
    'Decision Status': 'researching',
    'Titulo': 'Test Title',
    'Valor Estimado': '$45,000',
  };
  const merged = { ...defaults, ...overrides };
  return HEADERS.map((h) => merged[h] ?? '');
}

// Stub ensureInitialized by returning valid headers
function stubHeaders() {
  mockValuesGet.mockResolvedValueOnce({
    data: { values: [HEADERS] },
  });
}

describe('SheetsService', () => {
  let service: SheetsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SheetsService();
  });

  // ── parseDateValue ───────────────────────────────────────────────────
  describe('parseDateValue', () => {
    it('returns null for null input', () => {
      expect(service.parseDateValue(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(service.parseDateValue(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(service.parseDateValue('')).toBeNull();
    });

    it('returns null for "No disponible"', () => {
      expect(service.parseDateValue('No disponible')).toBeNull();
    });

    it('parses Google Sheets serial date number', () => {
      const serial = '45658';
      const result = service.parseDateValue(serial);
      expect(result).toBeInstanceOf(Date);
      expect(result!.getFullYear()).toBeGreaterThanOrEqual(2024);
    });

    it('parses ISO date strings', () => {
      const result = service.parseDateValue('2025-03-15');
      expect(result).toBeInstanceOf(Date);
      expect(result!.getFullYear()).toBe(2025);
    });

    it('parses MM/DD/YYYY date strings', () => {
      const result = service.parseDateValue('03/15/2025');
      expect(result).toBeInstanceOf(Date);
      expect(result!.getFullYear()).toBe(2025);
    });

    it('returns null for non-date string', () => {
      expect(service.parseDateValue('not a date at all xyz')).toBeNull();
    });
  });

  // ── formatDateLocal ──────────────────────────────────────────────────
  describe('formatDateLocal', () => {
    it('returns YYYY-MM-DD format', () => {
      const date = new Date(2025, 2, 15);
      expect(service.formatDateLocal(date)).toBe('2025-03-15');
    });

    it('pads single-digit months and days', () => {
      const date = new Date(2025, 0, 5);
      expect(service.formatDateLocal(date)).toBe('2025-01-05');
    });
  });

  // ── formatTimeValue ──────────────────────────────────────────────────
  describe('formatTimeValue', () => {
    it('returns null for null input', () => {
      expect(service.formatTimeValue(null)).toBeNull();
    });

    it('returns null for "No disponible"', () => {
      expect(service.formatTimeValue('No disponible')).toBeNull();
    });

    it('parses AM/PM time format', () => {
      expect(service.formatTimeValue('02:30 PM')).toBe('14:30');
    });

    it('parses 12:00 AM as 00:00', () => {
      expect(service.formatTimeValue('12:00 AM')).toBe('00:00');
    });

    it('parses 24-hour format', () => {
      expect(service.formatTimeValue('14:30')).toBe('14:30');
    });

    it('parses "10 AM"', () => {
      expect(service.formatTimeValue('10 AM')).toBe('10:00');
    });

    it('returns null for empty string', () => {
      expect(service.formatTimeValue('')).toBeNull();
    });

    it('handles a.m. notation', () => {
      expect(service.formatTimeValue('2:30 p.m.')).toBe('14:30');
    });

    it('parses fractional day value 0.5 as 12:00', () => {
      expect(service.formatTimeValue('0.5')).toBe('12:00');
    });

    it('parses integer hour 10 as 10:00', () => {
      expect(service.formatTimeValue('10')).toBe('10:00');
    });
  });

  // ── ensureInitialized ────────────────────────────────────────────────
  describe('ensureInitialized', () => {
    it('writes headers if sheet is empty', async () => {
      mockValuesGet.mockResolvedValueOnce({ data: { values: [] } });
      mockValuesUpdate.mockResolvedValueOnce({});
      await service.ensureInitialized();
      expect(mockValuesUpdate).toHaveBeenCalledTimes(1);
    });

    it('skips writing headers if already present', async () => {
      mockValuesGet.mockResolvedValueOnce({ data: { values: [HEADERS] } });
      await service.ensureInitialized();
      expect(mockValuesUpdate).not.toHaveBeenCalled();
    });

    it('writes headers if current headers are incomplete', async () => {
      mockValuesGet.mockResolvedValueOnce({ data: { values: [HEADERS.slice(0, 10)] } });
      mockValuesUpdate.mockResolvedValueOnce({});
      await service.ensureInitialized();
      expect(mockValuesUpdate).toHaveBeenCalledTimes(1);
    });

    it('only initializes once', async () => {
      mockValuesGet.mockResolvedValueOnce({ data: { values: [HEADERS] } });
      await service.ensureInitialized();
      await service.ensureInitialized(); // second call should no-op
      expect(mockValuesGet).toHaveBeenCalledTimes(1);
    });
  });

  // ── getLicitaciones ──────────────────────────────────────────────────
  describe('getLicitaciones', () => {
    it('returns parsed licitaciones from sheet rows', async () => {
      stubHeaders();
      mockValuesGet.mockResolvedValueOnce({
        data: { values: [makeRow()] },
      });

      const result = await service.getLicitaciones();
      expect(result).toHaveLength(1);
      expect(result[0].subject).toBe('Test Subject');
      expect(result[0].rowNumber).toBe(2);
      expect(result[0].id).toBe(2);
      expect(result[0].approvalStatus).toBe('pending');
    });

    it('returns empty array when no data rows', async () => {
      stubHeaders();
      mockValuesGet.mockResolvedValueOnce({ data: { values: [] } });

      const result = await service.getLicitaciones();
      expect(result).toEqual([]);
    });

    it('filters by status', async () => {
      stubHeaders();
      const row1 = makeRow({ 'Approval Status': 'pending' });
      const row2 = makeRow({ 'Approval Status': 'approved', 'Asunto': 'Approved One' });
      mockValuesGet.mockResolvedValueOnce({
        data: { values: [row1, row2] },
      });

      const result = await service.getLicitaciones({ status: 'approved' });
      expect(result).toHaveLength(1);
      expect(result[0].subject).toBe('Approved One');
    });

    it('filters by category', async () => {
      stubHeaders();
      const row1 = makeRow({ 'Categoria': 'Mantenimiento' });
      const row2 = makeRow({ 'Categoria': 'Construcción', 'Asunto': 'Building' });
      mockValuesGet.mockResolvedValueOnce({
        data: { values: [row1, row2] },
      });

      const result = await service.getLicitaciones({ category: 'Construcción' });
      expect(result).toHaveLength(1);
      expect(result[0].subject).toBe('Building');
    });

    it('filters by type=visits (has visitLocation)', async () => {
      stubHeaders();
      const row1 = makeRow({ 'Lugar de Visita': 'EBAS Torrecilla' });
      const row2 = makeRow({ 'Lugar de Visita': 'No disponible', 'Asunto': 'Purchase' });
      mockValuesGet.mockResolvedValueOnce({
        data: { values: [row1, row2] },
      });

      const result = await service.getLicitaciones({ type: 'visits' });
      expect(result).toHaveLength(1);
      expect(result[0].visitLocation).toBe('EBAS Torrecilla');
    });

    it('filters by type=purchases (no visitLocation)', async () => {
      stubHeaders();
      const row1 = makeRow({ 'Lugar de Visita': 'EBAS Torrecilla', 'Asunto': 'Visit' });
      const row2 = makeRow({ 'Lugar de Visita': 'No disponible', 'Asunto': 'Purchase' });
      mockValuesGet.mockResolvedValueOnce({
        data: { values: [row1, row2] },
      });

      const result = await service.getLicitaciones({ type: 'purchases' });
      expect(result).toHaveLength(1);
      expect(result[0].subject).toBe('Purchase');
    });

    it('filters by priority', async () => {
      stubHeaders();
      const row1 = makeRow({ 'Prioridad': 'High', 'Asunto': 'Urgent' });
      const row2 = makeRow({ 'Prioridad': 'Low' });
      mockValuesGet.mockResolvedValueOnce({
        data: { values: [row1, row2] },
      });

      const result = await service.getLicitaciones({ priority: 'high' });
      expect(result).toHaveLength(1);
      expect(result[0].subject).toBe('Urgent');
    });

    it('filters by town', async () => {
      stubHeaders();
      const row1 = makeRow({ 'Ubicacion': 'San Juan', 'Asunto': 'SJ' });
      const row2 = makeRow({ 'Ubicacion': 'Ponce', 'Asunto': 'Ponce' });
      mockValuesGet.mockResolvedValueOnce({
        data: { values: [row1, row2] },
      });

      const result = await service.getLicitaciones({ town: ['ponce'] });
      expect(result).toHaveLength(1);
      expect(result[0].subject).toBe('Ponce');
    });

    it('filters by interested', async () => {
      stubHeaders();
      const row1 = makeRow({ 'Interested': 'TRUE', 'Asunto': 'Interested' });
      const row2 = makeRow({ 'Interested': 'FALSE' });
      mockValuesGet.mockResolvedValueOnce({
        data: { values: [row1, row2] },
      });

      const result = await service.getLicitaciones({ interested: 'true' });
      expect(result).toHaveLength(1);
      expect(result[0].subject).toBe('Interested');
    });

    it('hides auto-rejected licitaciones', async () => {
      stubHeaders();
      const row1 = makeRow({ 'Approval Notes': '[Auto-rechazado: fecha vencida]', 'Approval Status': 'rejected' });
      const row2 = makeRow({ 'Asunto': 'Normal' });
      mockValuesGet.mockResolvedValueOnce({
        data: { values: [row1, row2] },
      });

      const result = await service.getLicitaciones();
      expect(result).toHaveLength(1);
      expect(result[0].subject).toBe('Normal');
    });

    it('parses boolean interested field', async () => {
      stubHeaders();
      const row = makeRow({ 'Interested': 'TRUE' });
      mockValuesGet.mockResolvedValueOnce({
        data: { values: [row] },
      });

      const result = await service.getLicitaciones();
      expect(result[0].interested).toBe(true);
    });

    it('normalizes date values', async () => {
      stubHeaders();
      const row = makeRow({
        'Fecha Site Visit': '06/15/2025',
        'Fecha Cierre Licitacion': '07/01/2025',
      });
      mockValuesGet.mockResolvedValueOnce({
        data: { values: [row] },
      });

      const result = await service.getLicitaciones();
      // parseDateValue → formatDateLocal produces YYYY-MM-DD
      expect(result[0].siteVisitDate).toBe('2025-06-15');
      expect(result[0].biddingCloseDate).toBe('2025-07-01');
    });
  });

  // ── getLicitacionByRow ───────────────────────────────────────────────
  describe('getLicitacionByRow', () => {
    it('returns a parsed licitacion for a valid row', async () => {
      stubHeaders();
      mockValuesGet.mockResolvedValueOnce({
        data: { values: [makeRow()] },
      });

      const result = await service.getLicitacionByRow(5);
      expect(result).not.toBeNull();
      expect(result!.rowNumber).toBe(5);
      expect(result!.subject).toBe('Test Subject');
    });

    it('returns null when row is empty', async () => {
      stubHeaders();
      mockValuesGet.mockResolvedValueOnce({ data: { values: [] } });

      const result = await service.getLicitacionByRow(5);
      expect(result).toBeNull();
    });
  });

  // ── updateApprovalStatus ─────────────────────────────────────────────
  describe('updateApprovalStatus', () => {
    it('updates status and returns updated licitacion', async () => {
      // ensureInitialized
      stubHeaders();
      // getLicitacionByRow (read current)
      mockValuesGet.mockResolvedValueOnce({
        data: { values: [makeRow()] },
      });
      // writeRow
      mockValuesUpdate.mockResolvedValueOnce({});
      // ensureInitialized (cached)
      // getLicitacionByRow (re-read after update)
      mockValuesGet.mockResolvedValueOnce({
        data: { values: [makeRow({ 'Approval Status': 'approved' })] },
      });

      const result = await service.updateApprovalStatus(5, 'approved', 'Good job');
      expect(result).not.toBeNull();
      expect(mockValuesUpdate).toHaveBeenCalled();
    });

    it('throws when row not found', async () => {
      stubHeaders();
      mockValuesGet.mockResolvedValueOnce({ data: { values: [] } });

      await expect(service.updateApprovalStatus(999, 'approved')).rejects.toThrow(
        /not found/
      );
    });
  });

  // ── updateFields ─────────────────────────────────────────────────────
  describe('updateFields', () => {
    it('updates interested field', async () => {
      stubHeaders();
      mockValuesGet.mockResolvedValueOnce({
        data: { values: [makeRow()] },
      });
      mockValuesUpdate.mockResolvedValueOnce({});
      mockValuesGet.mockResolvedValueOnce({
        data: { values: [makeRow({ 'Interested': 'TRUE' })] },
      });

      const result = await service.updateFields(5, { interested: true });
      expect(result).not.toBeNull();
      expect(mockValuesUpdate).toHaveBeenCalled();
    });

    it('throws when row not found', async () => {
      stubHeaders();
      mockValuesGet.mockResolvedValueOnce({ data: { values: [] } });

      await expect(service.updateFields(999, { interested: true })).rejects.toThrow(
        /not found/
      );
    });
  });

  // ── deleteLicitacion ─────────────────────────────────────────────────
  describe('deleteLicitacion', () => {
    it('deletes row and returns result', async () => {
      stubHeaders();
      // getLicitacionByRow
      mockValuesGet.mockResolvedValueOnce({
        data: { values: [makeRow({ 'Asunto': 'To Delete' })] },
      });
      mockBatchUpdate.mockResolvedValueOnce({});

      const result = await service.deleteLicitacion(5);
      expect(result.success).toBe(true);
      expect(result.deletedRow).toBe(5);
      expect(result.subject).toBe('To Delete');
      expect(mockBatchUpdate).toHaveBeenCalled();
    });

    it('throws when row not found', async () => {
      stubHeaders();
      mockValuesGet.mockResolvedValueOnce({ data: { values: [] } });

      await expect(service.deleteLicitacion(999)).rejects.toThrow(/not found/);
    });
  });

  // ── getStats ─────────────────────────────────────────────────────────
  describe('getStats', () => {
    it('returns correct counts', async () => {
      stubHeaders();
      const rows = [
        makeRow({ 'Approval Status': 'pending', 'Interested': 'FALSE' }),
        makeRow({ 'Approval Status': 'pending', 'Interested': 'TRUE', 'Email ID': 'msg-2' }),
        makeRow({ 'Approval Status': 'approved', 'Email ID': 'msg-3' }),
        makeRow({ 'Approval Status': 'rejected', 'Email ID': 'msg-4' }),
      ];
      mockValuesGet.mockResolvedValueOnce({ data: { values: rows } });

      const stats = await service.getStats();
      expect(stats.total).toBe(4);
      expect(stats.pending).toBe(2);
      expect(stats.approved).toBe(1);
      expect(stats.rejected).toBe(1);
      expect(stats.interested).toBe(1);
    });
  });

  // ── getDistinctFilterValues ──────────────────────────────────────────
  describe('getDistinctFilterValues', () => {
    it('returns unique towns and categories', async () => {
      stubHeaders();
      const rows = [
        makeRow({ 'Ubicacion': 'San Juan', 'Categoria': 'Mantenimiento' }),
        makeRow({ 'Ubicacion': 'Ponce', 'Categoria': 'Construcción', 'Email ID': 'msg-2' }),
        makeRow({ 'Ubicacion': 'San Juan', 'Categoria': 'Mantenimiento', 'Email ID': 'msg-3' }),
      ];
      mockValuesGet.mockResolvedValueOnce({ data: { values: rows } });

      const result = await service.getDistinctFilterValues();
      expect(result.towns).toHaveLength(2);
      expect(result.categories).toHaveLength(2);
    });

    it('excludes "No disponible" and "No clasificado"', async () => {
      stubHeaders();
      const rows = [
        makeRow({ 'Ubicacion': 'No disponible', 'Categoria': 'No clasificado' }),
        makeRow({ 'Ubicacion': 'Bayamón', 'Categoria': 'Tecnología', 'Email ID': 'msg-2' }),
      ];
      mockValuesGet.mockResolvedValueOnce({ data: { values: rows } });

      const result = await service.getDistinctFilterValues();
      expect(result.towns).toEqual(['Bayamón']);
      expect(result.categories).toEqual(['Tecnología']);
    });
  });

  // ── appendLicitacionData ─────────────────────────────────────────────
  describe('appendLicitacionData', () => {
    it('appends a row to the sheet', async () => {
      stubHeaders();
      mockValuesAppend.mockResolvedValueOnce({ data: {} });

      const data = {
        processedAt: '2025-03-01T10:00:00Z',
        emailDate: '2025-03-01',
        subject: 'New Entry',
        emailId: 'msg-new',
      };

      await service.appendLicitacionData(data);
      expect(mockValuesAppend).toHaveBeenCalledTimes(1);
    });
  });

  // ── upsertLicitacion ─────────────────────────────────────────────────
  describe('upsertLicitacion', () => {
    it('throws if emailId is missing', async () => {
      stubHeaders();
      await expect(service.upsertLicitacion({})).rejects.toThrow(/emailId is required/);
    });

    it('creates new row if emailId not found', async () => {
      stubHeaders();
      // findRowByEmailId - no existing rows
      mockValuesGet.mockResolvedValueOnce({ data: { values: [] } });
      // appendLicitacionData
      mockValuesAppend.mockResolvedValueOnce({ data: {} });
      // getLastRowNumber
      mockValuesGet.mockResolvedValueOnce({ data: { values: [['h'], ['r1'], ['r2']] } });

      const result = await service.upsertLicitacion({
        emailId: 'msg-new',
        subject: 'New',
      });
      expect(result.rowNumber).toBe(3);
      expect(mockValuesAppend).toHaveBeenCalled();
    });

    it('updates existing row if emailId found', async () => {
      stubHeaders();
      // findRowByEmailId - found at row 3
      const existingRow = makeRow({ 'Email ID': 'msg-existing' });
      mockValuesGet.mockResolvedValueOnce({
        data: { values: [existingRow] },
      });
      // writeRow
      mockValuesUpdate.mockResolvedValueOnce({});

      const result = await service.upsertLicitacion({
        emailId: 'msg-existing',
        subject: 'Updated',
      });
      expect(result.rowNumber).toBe(2);
      expect(mockValuesUpdate).toHaveBeenCalled();
    });
  });

  // ── getSiteVisitEvents ───────────────────────────────────────────────
  describe('getSiteVisitEvents', () => {
    it('returns events for licitaciones with visit dates', async () => {
      stubHeaders();
      const rows = [
        makeRow({ 'Fecha Site Visit': '2025-03-15', 'Hora Site Visit': '10:00 AM' }),
        makeRow({ 'Fecha Site Visit': 'No disponible', 'Email ID': 'msg-2' }),
      ];
      mockValuesGet.mockResolvedValueOnce({ data: { values: rows } });

      const events = await service.getSiteVisitEvents();
      expect(events).toHaveLength(1);
    });

    it('returns empty array when no visits', async () => {
      stubHeaders();
      mockValuesGet.mockResolvedValueOnce({
        data: { values: [makeRow({ 'Fecha Site Visit': 'No disponible' })] },
      });

      const events = await service.getSiteVisitEvents();
      expect(events).toHaveLength(0);
    });
  });

  // ── autoRejectExpired ────────────────────────────────────────────────
  describe('autoRejectExpired', () => {
    it('rejects licitaciones with past close dates', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-06-01'));

      // getLicitaciones calls ensureInitialized + values.get
      stubHeaders();
      const rows = [
        makeRow({
          'Approval Status': 'pending',
          'Fecha Cierre Licitacion': '01/01/2025',
          'Fecha Site Visit': 'No disponible',
        }),
        makeRow({
          'Approval Status': 'pending',
          'Fecha Cierre Licitacion': '12/01/2025',
          'Fecha Site Visit': 'No disponible',
          'Email ID': 'msg-2',
        }),
      ];
      mockValuesGet.mockResolvedValueOnce({ data: { values: rows } });

      // updateApprovalStatus for the expired one:
      // getLicitacionByRow
      mockValuesGet.mockResolvedValueOnce({
        data: { values: [rows[0]] },
      });
      // writeRow
      mockValuesUpdate.mockResolvedValueOnce({});
      // getLicitacionByRow (re-read)
      mockValuesGet.mockResolvedValueOnce({
        data: { values: [makeRow({ 'Approval Status': 'rejected' })] },
      });

      const count = await service.autoRejectExpired();
      expect(count).toBe(1);

      vi.useRealTimers();
    });

    it('returns 0 when no expired licitaciones', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01'));

      stubHeaders();
      const rows = [
        makeRow({
          'Approval Status': 'pending',
          'Fecha Cierre Licitacion': '12/01/2025',
          'Fecha Site Visit': 'No disponible',
        }),
      ];
      mockValuesGet.mockResolvedValueOnce({ data: { values: rows } });

      const count = await service.autoRejectExpired();
      expect(count).toBe(0);

      vi.useRealTimers();
    });
  });
});
