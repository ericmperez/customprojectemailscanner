import { SupabaseLicitacionesService } from './supabase-licitaciones.service';
import type { Licitacion, Filters, Stats, FilterOptions, Visit } from '@/lib/types';

const service = new SupabaseLicitacionesService();

class LicitacionesService {
  async saveLicitacion(orgId: string, data: Record<string, unknown>): Promise<{ id: string }> {
    const result = await service.upsertLicitacion(orgId, data);
    console.log(`Saved licitación to Supabase: ${data.emailId}`);
    return result;
  }

  async getAllLicitaciones(orgId: string, filters: Filters = {}): Promise<Licitacion[]> {
    return service.getLicitaciones(orgId, filters);
  }

  async getLicitacionById(orgId: string, id: string): Promise<Licitacion | null> {
    return service.getLicitacionById(orgId, id);
  }

  async updateApprovalStatus(orgId: string, id: string, status: string, notes = ''): Promise<Licitacion | null> {
    const updated = await service.updateApprovalStatus(orgId, id, status, notes);
    console.log(`Updated approval status for licitación ${id}: ${status}`);
    return updated;
  }

  async updateFields(orgId: string, id: string, fields: Record<string, unknown>): Promise<{ updated: Licitacion | null; oldValues: Record<string, string> }> {
    const result = await service.updateFields(orgId, id, fields);
    console.log(`Updated fields for licitación ${id}:`, fields);
    return result;
  }

  async autoDeleteExpired(orgId: string): Promise<number> {
    return service.autoDeleteExpired(orgId);
  }

  async deleteLicitacion(orgId: string, id: string): Promise<{ success: boolean; id: string; subject: string }> {
    const result = await service.deleteLicitacion(orgId, id);
    console.log(`Deleted licitación ${id}`);
    return result;
  }

  async getStats(orgId: string): Promise<Stats> {
    try {
      return await service.getStats(orgId);
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      return { total: 0, pending: 0, approved: 0, rejected: 0, interested: 0 };
    }
  }

  async getDistinctFilterValues(orgId: string): Promise<FilterOptions> {
    try {
      return await service.getDistinctFilterValues(orgId);
    } catch (error) {
      console.error('Error getting distinct filter values:', error);
      return { towns: [], categories: [] };
    }
  }

  async getSiteVisitEvents(orgId: string, filters: Filters = {}): Promise<Visit[]> {
    return service.getSiteVisitEvents(orgId, filters);
  }
}

export default LicitacionesService;
