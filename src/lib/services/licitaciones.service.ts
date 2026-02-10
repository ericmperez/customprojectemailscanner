import SheetsService from './sheets.service';
import type { Licitacion, Filters, Stats, FilterOptions } from '@/lib/types';

class LicitacionesService {
  private sheetsService: SheetsService;

  constructor() {
    this.sheetsService = new SheetsService();
  }

  async ensureTableExists(): Promise<void> {
    await this.sheetsService.ensureInitialized();
  }

  async saveLicitacion(data: Record<string, unknown>): Promise<unknown> {
    const result = await this.sheetsService.upsertLicitacion(data);
    console.log(`Saved licitación to Google Sheets: ${data.emailId}`);
    return result;
  }

  async getAllLicitaciones(filters: Filters = {}): Promise<Licitacion[]> {
    return this.sheetsService.getLicitaciones(filters);
  }

  async getLicitacionById(id: number | string): Promise<Licitacion | null> {
    return this.sheetsService.getLicitacionByRow(Number(id));
  }

  async updateApprovalStatus(id: number | string, status: string, notes = ''): Promise<Licitacion | null> {
    const updated = await this.sheetsService.updateApprovalStatus(Number(id), status, notes);
    console.log(`Updated approval status for licitación ${id}: ${status}`);
    return updated;
  }

  async deleteLicitacion(id: number | string): Promise<{ success: boolean; deletedRow: number; subject: string }> {
    const result = await this.sheetsService.deleteLicitacion(Number(id));
    console.log(`Deleted licitación ${id}`);
    return result;
  }

  async getStats(): Promise<Stats> {
    try {
      return await this.sheetsService.getStats();
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      return { total: 0, pending: 0, approved: 0, rejected: 0 };
    }
  }

  async getDistinctFilterValues(): Promise<FilterOptions> {
    try {
      return await this.sheetsService.getDistinctFilterValues();
    } catch (error) {
      console.error('Error getting distinct filter values:', error);
      return { towns: [], categories: [] };
    }
  }

  async getSiteVisitEvents(filters: Filters = {}): Promise<unknown[]> {
    return this.sheetsService.getSiteVisitEvents(filters);
  }
}

export default LicitacionesService;
