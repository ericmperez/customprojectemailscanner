import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Licitacion, Filters, Stats, FilterOptions, Visit } from '@/lib/types';

function getClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_KEY');
  return createClient(url, key);
}

// Map DB snake_case rows to camelCase Licitacion objects
function rowToLicitacion(row: Record<string, unknown>): Licitacion {
  return {
    id: row.id as string,
    processedAt: (row.processed_at as string) || '',
    emailDate: (row.email_date as string) || '',
    subject: (row.subject as string) || '',
    title: (row.title as string) || '',
    location: (row.location as string) || '',
    description: (row.description as string) || '',
    summary: (row.summary as string) || '',
    category: (row.category as string) || '',
    priority: (row.priority as string) || 'Medium',
    pdfFilename: (row.pdf_filename as string) || '',
    pdfLink: (row.pdf_url as string) || '',
    pdfUrl: (row.pdf_url as string) || '',
    siteVisitDate: (row.site_visit_date as string) || '',
    siteVisitTime: (row.site_visit_time as string) || '',
    visitLocation: (row.visit_location as string) || '',
    visitRequirements: (row.visit_requirements as string) || '',
    contactName: (row.contact_name as string) || '',
    contactPhone: (row.contact_phone as string) || '',
    contactEmail: (row.contact_email as string) || undefined,
    biddingCloseDate: (row.bidding_close_date as string) || '',
    biddingCloseTime: (row.bidding_close_time as string) || '',
    estimatedValue: (row.estimated_value as string) || '',
    extractionMethod: (row.extraction_method as string) || '',
    emailId: (row.email_id as string) || '',
    approvalStatus: ((row.approval_status as string) || 'pending') as 'pending' | 'approved' | 'rejected',
    approvalNotes: (row.approval_notes as string) || '',
    interested: (row.interested as boolean) || false,
    isEmergency: (row.is_emergency as boolean) || false,
    decisionStatus: (row.decision_status as string) || 'researching',
    quoteUrl: (row.quote_url as string) || '',
    visitAttendance: (row.visit_attendance as 'attending' | 'skipped' | null) ?? null,
  };
}

// Map camelCase input data to DB snake_case columns
function dataToRow(data: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const mapping: Record<string, string> = {
    processedAt: 'processed_at',
    emailDate: 'email_date',
    subject: 'subject',
    title: 'title',
    location: 'location',
    description: 'description',
    summary: 'summary',
    category: 'category',
    priority: 'priority',
    pdfFilename: 'pdf_filename',
    pdfLink: 'pdf_url',
    pdfUrl: 'pdf_url',
    siteVisitDate: 'site_visit_date',
    siteVisitTime: 'site_visit_time',
    visitLocation: 'visit_location',
    visitRequirements: 'visit_requirements',
    contactName: 'contact_name',
    contactPhone: 'contact_phone',
    contactEmail: 'contact_email',
    biddingCloseDate: 'bidding_close_date',
    biddingCloseTime: 'bidding_close_time',
    estimatedValue: 'estimated_value',
    extractionMethod: 'extraction_method',
    emailId: 'email_id',
    approvalStatus: 'approval_status',
    approvalNotes: 'approval_notes',
    interested: 'interested',
    isEmergency: 'is_emergency',
    decisionStatus: 'decision_status',
    quoteUrl: 'quote_url',
    visitAttendance: 'visit_attendance',
  };

  for (const [key, value] of Object.entries(data)) {
    const dbKey = mapping[key];
    if (dbKey && value !== undefined) {
      // Clean up Sheets HYPERLINK formulas - extract just the URL
      if (dbKey === 'pdf_url' && typeof value === 'string') {
        const hyperlinkMatch = value.match(/(?:HYPERLINK|HIPERVINCULO)\s*\(\s*"([^"]+)"/i);
        row[dbKey] = hyperlinkMatch ? hyperlinkMatch[1] : value;
      } else {
        row[dbKey] = value;
      }
    }
  }

  return row;
}

export class SupabaseLicitacionesService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = getClient();
  }

  async getLicitaciones(orgId: string, filters: Filters = {}): Promise<Licitacion[]> {
    let query = this.supabase
      .from('licitaciones')
      .select('*')
      .eq('org_id', orgId)
      .order('processed_at', { ascending: false });

    // Apply filters at the DB level where possible
    if (filters.status) {
      query = query.eq('approval_status', filters.status.toLowerCase());
    }
    if (filters.category) {
      query = query.ilike('category', filters.category);
    }
    if (filters.priority) {
      query = query.ilike('priority', filters.priority);
    }
    if (filters.interested === 'true') {
      query = query.eq('interested', true);
    } else if (filters.interested === 'false') {
      query = query.eq('interested', false);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching licitaciones:', error);
      throw error;
    }

    let licitaciones = (data || []).map(rowToLicitacion);

    // Hide auto-rejected licitaciones
    licitaciones = licitaciones.filter((lic) => {
      const notes = (lic.approvalNotes || '').toString();
      return !notes.includes('[Auto-rechazado');
    });

    // Apply client-side filters that are harder to do in SQL
    licitaciones = this.applyClientFilters(licitaciones, filters);

    return licitaciones;
  }

  async getLicitacionById(orgId: string, id: string): Promise<Licitacion | null> {
    const { data, error } = await this.supabase
      .from('licitaciones')
      .select('*')
      .eq('org_id', orgId)
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return rowToLicitacion(data);
  }

  async upsertLicitacion(orgId: string, inputData: Record<string, unknown>): Promise<{ id: string }> {
    const dbRow = dataToRow(inputData);
    dbRow.org_id = orgId;
    dbRow.updated_at = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('licitaciones')
      .upsert(dbRow, { onConflict: 'org_id,email_id' })
      .select('id')
      .single();

    if (error) {
      console.error('Error upserting licitacion:', error);
      throw error;
    }

    return { id: data.id };
  }

  async updateApprovalStatus(
    orgId: string,
    id: string,
    status: string,
    notes = ''
  ): Promise<Licitacion | null> {
    const update: Record<string, unknown> = {
      approval_status: status,
      approval_notes: notes,
      updated_at: new Date().toISOString(),
    };

    if (status === 'approved') {
      update.decision_status = 'approved';
    } else if (status === 'rejected') {
      update.decision_status = 'rejected';
    }

    const { data, error } = await this.supabase
      .from('licitaciones')
      .update(update)
      .eq('org_id', orgId)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating approval status:', error);
      throw error;
    }

    return data ? rowToLicitacion(data) : null;
  }

  async updateFields(
    orgId: string,
    id: string,
    fields: Record<string, unknown>
  ): Promise<{ updated: Licitacion | null; oldValues: Record<string, string> }> {
    // First fetch current values for diff
    const current = await this.getLicitacionById(orgId, id);
    if (!current) throw new Error(`Licitación ${id} not found`);

    const oldValues: Record<string, string> = {};
    const currentRecord = current as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        oldValues[key] = String(currentRecord[key] ?? '');
      }
    }

    const dbRow = dataToRow(fields);
    dbRow.updated_at = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('licitaciones')
      .update(dbRow)
      .eq('org_id', orgId)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating fields:', error);
      throw error;
    }

    return { updated: data ? rowToLicitacion(data) : null, oldValues };
  }

  async deleteLicitacion(orgId: string, id: string): Promise<{ success: boolean; id: string; subject: string }> {
    const current = await this.getLicitacionById(orgId, id);
    if (!current) throw new Error(`Licitación ${id} not found`);

    const { error } = await this.supabase
      .from('licitaciones')
      .delete()
      .eq('org_id', orgId)
      .eq('id', id);

    if (error) {
      console.error('Error deleting licitacion:', error);
      throw error;
    }

    return { success: true, id, subject: current.subject };
  }

  async getStats(orgId: string): Promise<Stats> {
    const { data, error } = await this.supabase
      .from('licitaciones')
      .select('approval_status, interested, approval_notes')
      .eq('org_id', orgId);

    if (error) {
      console.error('Error fetching stats:', error);
      return { total: 0, pending: 0, approved: 0, rejected: 0, interested: 0 };
    }

    // Filter out auto-rejected
    const visible = (data || []).filter(
      (row) => !(row.approval_notes || '').includes('[Auto-rechazado')
    );

    return {
      total: visible.length,
      pending: visible.filter((r) => r.approval_status === 'pending').length,
      approved: visible.filter((r) => r.approval_status === 'approved').length,
      rejected: visible.filter((r) => r.approval_status === 'rejected').length,
      interested: visible.filter((r) => r.interested).length,
    };
  }

  async getDistinctFilterValues(orgId: string): Promise<FilterOptions> {
    const { data, error } = await this.supabase
      .from('licitaciones')
      .select('location, category')
      .eq('org_id', orgId);

    if (error) {
      console.error('Error fetching filter values:', error);
      return { towns: [], categories: [] };
    }

    const townSet = new Set<string>();
    const categorySet = new Set<string>();

    for (const row of data || []) {
      const loc = (row.location || '').trim();
      if (loc && loc.toLowerCase() !== 'no disponible') townSet.add(loc);
      const cat = (row.category || '').trim();
      if (cat && cat.toLowerCase() !== 'no clasificado') categorySet.add(cat);
    }

    const collator = new Intl.Collator('es', { sensitivity: 'base' });
    return {
      towns: [...townSet].sort(collator.compare),
      categories: [...categorySet].sort(collator.compare),
    };
  }

  async getSiteVisitEvents(orgId: string, filters: Filters = {}): Promise<Visit[]> {
    const licitaciones = await this.getLicitaciones(orgId, filters);

    return licitaciones
      .filter((lic) => {
        const visitDate = lic.siteVisitDate;
        return visitDate && visitDate !== 'No disponible';
      })
      .map((lic) => ({
        id: lic.id,
        subject: lic.subject || 'Sin título',
        title: lic.title,
        location: lic.location || 'No disponible',
        visitLocation: lic.visitLocation || 'No disponible',
        category: lic.category || 'No clasificado',
        approvalStatus: lic.approvalStatus || 'pending',
        decisionStatus: lic.decisionStatus || 'researching',
        visitRequirements: lic.visitRequirements,
        visitDate: lic.siteVisitDate,
        visitTime: lic.siteVisitTime || null,
        rawVisitDate: lic.siteVisitDate,
        rawVisitTime: lic.siteVisitTime,
        pdfLink: lic.pdfLink,
        pdfUrl: lic.pdfUrl,
        pdfFilename: lic.pdfFilename,
        emailDate: lic.emailDate,
        visitAttendance: lic.visitAttendance,
        interested: lic.interested,
      }))
      .sort((a, b) => {
        const aDate = new Date(`${a.visitDate}T${a.visitTime || '00:00'}:00`);
        const bDate = new Date(`${b.visitDate}T${b.visitTime || '00:00'}:00`);
        return aDate.getTime() - bDate.getTime();
      });
  }

  async autoRejectExpired(orgId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('licitaciones')
      .select('id, bidding_close_date, site_visit_date, approval_status, approval_notes')
      .eq('org_id', orgId)
      .eq('approval_status', 'pending');

    if (error || !data) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const updates: Promise<void>[] = [];

    for (const row of data) {
      let shouldReject = false;
      let rejectReason = '';

      if (row.bidding_close_date && row.bidding_close_date !== 'No disponible') {
        try {
          const closeDate = new Date(row.bidding_close_date);
          closeDate.setHours(23, 59, 59, 999);
          if (closeDate < today) {
            shouldReject = true;
            rejectReason = '[Auto-rechazado: fecha de cierre vencida]';
          }
        } catch { /* ignore */ }
      }

      if (!shouldReject && row.site_visit_date && row.site_visit_date !== 'No disponible') {
        try {
          const visitDate = new Date(row.site_visit_date);
          visitDate.setHours(23, 59, 59, 999);
          if (visitDate < today) {
            shouldReject = true;
            rejectReason = '[Auto-rechazado: fecha de visita vencida]';
          }
        } catch { /* ignore */ }
      }

      if (shouldReject) {
        const notes = row.approval_notes
          ? `${row.approval_notes}\n${rejectReason}`
          : rejectReason;

        updates.push(
          Promise.resolve(
            this.supabase
              .from('licitaciones')
              .update({
                approval_status: 'rejected',
                approval_notes: notes,
                decision_status: 'rejected',
                updated_at: new Date().toISOString(),
              })
              .eq('id', row.id)
              .eq('org_id', orgId)
          )
            .then(() => {})
            .catch((err) => console.error(`Error auto-rejecting ${row.id}:`, err))
        );
      }
    }

    if (updates.length > 0) {
      await Promise.all(updates).catch((err) =>
        console.error('Some auto-reject updates failed:', err)
      );
    }

    return updates.length;
  }

  // Client-side filters for things harder to express in SQL
  private applyClientFilters(licitaciones: Licitacion[], filters: Filters): Licitacion[] {
    let result = licitaciones;

    if (filters.type) {
      if (filters.type === 'visits') {
        result = result.filter((lic) => {
          const location = (lic.visitLocation || '').trim();
          return location && location.toLowerCase() !== 'no disponible';
        });
      } else if (filters.type === 'purchases') {
        result = result.filter((lic) => {
          const location = (lic.visitLocation || '').trim();
          return !location || location.toLowerCase() === 'no disponible';
        });
      }
    }

    if (filters.town && Array.isArray(filters.town) && filters.town.length > 0) {
      const lowerTowns = filters.town.map((t) => t.toLowerCase());
      result = result.filter((lic) => {
        const loc = (lic.location || '').toLowerCase();
        return lowerTowns.some((t) => loc.includes(t));
      });
    }

    if (filters.dateRange) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      result = result.filter((lic) => {
        const visitDateStr = lic.siteVisitDate;
        if (!visitDateStr || visitDateStr === 'No disponible') return false;
        const visitDate = new Date(visitDateStr);
        if (isNaN(visitDate.getTime())) return false;
        const visitDateTime = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate());

        switch (filters.dateRange) {
          case 'today':
            return visitDateTime.getTime() === today.getTime();
          case 'this-week':
          case 'visits-this-week': {
            const dayOfWeek = today.getDay();
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - dayOfWeek);
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            return visitDateTime >= startOfWeek && visitDateTime <= endOfWeek;
          }
          case 'next-week':
          case 'visits-next-week': {
            const nextWeekStart = new Date(today);
            nextWeekStart.setDate(today.getDate() + (7 - today.getDay()));
            const nextWeekEnd = new Date(nextWeekStart);
            nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
            return visitDateTime >= nextWeekStart && visitDateTime <= nextWeekEnd;
          }
          case 'next-2-weeks':
          case 'visits-next-2-weeks': {
            const twoWeeksLater = new Date(today);
            twoWeeksLater.setDate(today.getDate() + 14);
            return visitDateTime >= today && visitDateTime <= twoWeeksLater;
          }
          case 'next-month': {
            const oneMonthLater = new Date(today);
            oneMonthLater.setMonth(today.getMonth() + 1);
            return visitDateTime >= today && visitDateTime <= oneMonthLater;
          }
          case 'past':
            return visitDateTime < today;
          default:
            return true;
        }
      });
    }

    return result;
  }
}
