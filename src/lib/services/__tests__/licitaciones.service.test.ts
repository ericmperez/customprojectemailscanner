import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Build the mock SheetsService instance ───────────────────────────────
const mockSheetsService = {
  ensureInitialized: vi.fn().mockResolvedValue(undefined),
  getLicitaciones: vi.fn(),
  getLicitacionByRow: vi.fn(),
  updateApprovalStatus: vi.fn(),
  updateFields: vi.fn(),
  deleteLicitacion: vi.fn(),
  getStats: vi.fn(),
  getDistinctFilterValues: vi.fn(),
  getSiteVisitEvents: vi.fn(),
  upsertLicitacion: vi.fn(),
  autoRejectExpired: vi.fn(),
  appendLicitacionData: vi.fn(),
};

vi.mock('@/lib/services/sheets.service', () => {
  return {
    default: vi.fn().mockImplementation(function () {
      return mockSheetsService;
    }),
  };
});

import LicitacionesService from '@/lib/services/licitaciones.service';
import type { Licitacion } from '@/lib/types';

describe('LicitacionesService', () => {
  let service: LicitacionesService;

  const makeLicitacion = (overrides: Partial<Licitacion> = {}): Licitacion => ({
    id: 2,
    rowNumber: 2,
    processedAt: '2025-01-15T10:00:00Z',
    emailDate: '2025-01-14',
    subject: 'Test Subject',
    title: 'Test Title',
    location: 'San Juan',
    description: 'Description',
    summary: 'Summary',
    category: 'Mantenimiento',
    priority: 'Medium',
    pdfFilename: 'test.pdf',
    pdfLink: 'https://example.com/test.pdf',
    pdfUrl: 'https://example.com/test.pdf',
    siteVisitDate: '2025-02-01',
    siteVisitTime: '10:00',
    visitLocation: 'EBAS Torrecilla',
    contactName: 'Juan',
    contactPhone: '(787) 555-1234',
    biddingCloseDate: '2025-03-01',
    biddingCloseTime: '14:00',
    estimatedValue: '$50,000',
    extractionMethod: 'GPT-4o',
    emailId: 'email-1',
    approvalStatus: 'pending',
    approvalNotes: '',
    interested: false,
    decisionStatus: 'researching',
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LicitacionesService();
  });

  // ── ensureTableExists ─────────────────────────────────────────────────

  describe('ensureTableExists', () => {
    it('delegates to sheetsService.ensureInitialized', async () => {
      await service.ensureTableExists();
      expect(mockSheetsService.ensureInitialized).toHaveBeenCalled();
    });
  });

  // ── getAllLicitaciones ────────────────────────────────────────────────

  describe('getAllLicitaciones', () => {
    it('delegates to sheetsService.getLicitaciones', async () => {
      const licitaciones = [makeLicitacion()];
      mockSheetsService.getLicitaciones.mockResolvedValue(licitaciones);

      const result = await service.getAllLicitaciones();

      expect(mockSheetsService.getLicitaciones).toHaveBeenCalledWith({});
      expect(result).toEqual(licitaciones);
    });

    it('passes filters to sheetsService.getLicitaciones', async () => {
      mockSheetsService.getLicitaciones.mockResolvedValue([]);

      await service.getAllLicitaciones({ status: 'approved' });

      expect(mockSheetsService.getLicitaciones).toHaveBeenCalledWith({ status: 'approved' });
    });
  });

  // ── getLicitacionById ─────────────────────────────────────────────────

  describe('getLicitacionById', () => {
    it('calls sheetsService.getLicitacionByRow with Number(id)', async () => {
      const lic = makeLicitacion();
      mockSheetsService.getLicitacionByRow.mockResolvedValue(lic);

      const result = await service.getLicitacionById('5');

      expect(mockSheetsService.getLicitacionByRow).toHaveBeenCalledWith(5);
      expect(result).toEqual(lic);
    });

    it('handles numeric id parameter', async () => {
      mockSheetsService.getLicitacionByRow.mockResolvedValue(null);

      const result = await service.getLicitacionById(10);

      expect(mockSheetsService.getLicitacionByRow).toHaveBeenCalledWith(10);
      expect(result).toBeNull();
    });
  });

  // ── updateApprovalStatus ──────────────────────────────────────────────

  describe('updateApprovalStatus', () => {
    it('delegates to sheetsService.updateApprovalStatus', async () => {
      const updated = makeLicitacion({ approvalStatus: 'approved' });
      mockSheetsService.updateApprovalStatus.mockResolvedValue(updated);

      const result = await service.updateApprovalStatus('3', 'approved', 'Good');

      expect(mockSheetsService.updateApprovalStatus).toHaveBeenCalledWith(3, 'approved', 'Good');
      expect(result?.approvalStatus).toBe('approved');
    });

    it('uses empty string for notes when not provided', async () => {
      mockSheetsService.updateApprovalStatus.mockResolvedValue(makeLicitacion());

      await service.updateApprovalStatus(5, 'rejected');

      expect(mockSheetsService.updateApprovalStatus).toHaveBeenCalledWith(5, 'rejected', '');
    });
  });

  // ── updateFields ──────────────────────────────────────────────────────

  describe('updateFields', () => {
    it('delegates to sheetsService.updateFields', async () => {
      const updated = makeLicitacion({ interested: true });
      mockSheetsService.updateFields.mockResolvedValue(updated);

      const result = await service.updateFields('7', { interested: true });

      expect(mockSheetsService.updateFields).toHaveBeenCalledWith(7, { interested: true });
      expect(result?.interested).toBe(true);
    });
  });

  // ── deleteLicitacion ──────────────────────────────────────────────────

  describe('deleteLicitacion', () => {
    it('delegates to sheetsService.deleteLicitacion', async () => {
      mockSheetsService.deleteLicitacion.mockResolvedValue({
        success: true,
        deletedRow: 4,
        subject: 'Deleted',
      });

      const result = await service.deleteLicitacion('4');

      expect(mockSheetsService.deleteLicitacion).toHaveBeenCalledWith(4);
      expect(result.success).toBe(true);
    });
  });

  // ── getStats ──────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('returns stats from sheetsService', async () => {
      const stats = { total: 10, pending: 5, approved: 3, rejected: 2, interested: 1 };
      mockSheetsService.getStats.mockResolvedValue(stats);

      const result = await service.getStats();
      expect(result).toEqual(stats);
    });

    it('returns fallback {total:0,...} on error', async () => {
      mockSheetsService.getStats.mockRejectedValue(new Error('Sheets API error'));

      const result = await service.getStats();

      expect(result).toEqual({
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        interested: 0,
      });
    });
  });

  // ── getDistinctFilterValues ───────────────────────────────────────────

  describe('getDistinctFilterValues', () => {
    it('returns filter values from sheetsService', async () => {
      const filters = { towns: ['San Juan', 'Ponce'], categories: ['Mantenimiento'] };
      mockSheetsService.getDistinctFilterValues.mockResolvedValue(filters);

      const result = await service.getDistinctFilterValues();
      expect(result).toEqual(filters);
    });

    it('returns fallback on error', async () => {
      mockSheetsService.getDistinctFilterValues.mockRejectedValue(new Error('fail'));

      const result = await service.getDistinctFilterValues();
      expect(result).toEqual({ towns: [], categories: [] });
    });
  });

  // ── saveLicitacion ────────────────────────────────────────────────────

  describe('saveLicitacion', () => {
    it('delegates to sheetsService.upsertLicitacion', async () => {
      mockSheetsService.upsertLicitacion.mockResolvedValue({ rowNumber: 5 });

      const data = { emailId: 'e1', subject: 'Test' };
      const result = await service.saveLicitacion(data);

      expect(mockSheetsService.upsertLicitacion).toHaveBeenCalledWith(data);
      expect(result).toEqual({ rowNumber: 5 });
    });
  });

  // ── getSiteVisitEvents ────────────────────────────────────────────────

  describe('getSiteVisitEvents', () => {
    it('delegates to sheetsService.getSiteVisitEvents', async () => {
      const events = [{ id: 1, visitDate: '2025-02-01' }];
      mockSheetsService.getSiteVisitEvents.mockResolvedValue(events);

      const result = await service.getSiteVisitEvents({ status: 'approved' });

      expect(mockSheetsService.getSiteVisitEvents).toHaveBeenCalledWith({ status: 'approved' });
      expect(result).toEqual(events);
    });
  });
});
