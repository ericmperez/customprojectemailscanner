import { google, sheets_v4 } from 'googleapis';
import { normalizeVisitLocationLabel } from './visit-location.utils';
import type { Licitacion, Filters } from '@/lib/types';

const config = {
  gmail: {
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    redirectUri: process.env.GMAIL_REDIRECT_URI,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN,
  },
  sheets: {
    sheetId: process.env.GOOGLE_SHEET_ID!,
    sheetName: process.env.SHEET_NAME || 'Licitaciones',
  },
};

const HEADERS = [
  'Fecha de Procesamiento',
  'Fecha del Email',
  'Asunto',
  'Ubicacion',
  'Descripcion',
  'Resumen',
  'Categoria',
  'Prioridad',
  'Archivo PDF',
  'Ver PDF',
  'Fecha Site Visit',
  'Hora Site Visit',
  'Lugar de Visita',
  'Nombre Contacto',
  'Telefono Contacto',
  'Fecha Cierre Licitacion',
  'Hora Cierre Licitacion',
  'Metodo Extraccion',
  'Email ID',
  'Approval Status',
  'Approval Notes',
  'Interested',
  'Decision Status',
  'Titulo',
];

const HEADER_KEY_MAP: Record<string, string> = {
  'Fecha de Procesamiento': 'processedAt',
  'Fecha del Email': 'emailDate',
  'Asunto': 'subject',
  'Ubicacion': 'location',
  'Descripcion': 'description',
  'Resumen': 'summary',
  'Categoria': 'category',
  'Prioridad': 'priority',
  'Archivo PDF': 'pdfFilename',
  'Ver PDF': 'pdfLink',
  'Fecha Site Visit': 'siteVisitDate',
  'Hora Site Visit': 'siteVisitTime',
  'Lugar de Visita': 'visitLocation',
  'Nombre Contacto': 'contactName',
  'Telefono Contacto': 'contactPhone',
  'Fecha Cierre Licitacion': 'biddingCloseDate',
  'Hora Cierre Licitacion': 'biddingCloseTime',
  'Metodo Extraccion': 'extractionMethod',
  'Email ID': 'emailId',
  'Approval Status': 'approvalStatus',
  'Approval Notes': 'approvalNotes',
  'Interested': 'interested',
  'Decision Status': 'decisionStatus',
  'Titulo': 'title',
};

const DEFAULT_STATUS = 'pending';
const DEFAULT_DECISION_STATUS = 'researching';

class SheetsService {
  private oauth2Client;
  private sheets: sheets_v4.Sheets;
  private sheetId: string;
  private sheetName: string;
  private initialized = false;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      config.gmail.clientId,
      config.gmail.clientSecret,
      config.gmail.redirectUri
    );

    this.oauth2Client.setCredentials({
      refresh_token: config.gmail.refreshToken,
    });

    this.sheets = google.sheets({ version: 'v4', auth: this.oauth2Client });
    this.sheetId = config.sheets.sheetId;
    this.sheetName = config.sheets.sheetName;
  }

  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.sheetId,
      range: `${this.sheetName}!A1:${this.columnLetter(HEADERS.length)}1`,
    });

    const values = response.data.values;

    if (!values || values.length === 0) {
      await this.writeHeaders();
    } else {
      const currentHeaders = values[0];
      if (currentHeaders.length < HEADERS.length) {
        await this.writeHeaders();
      } else {
        const needsUpdate = HEADERS.some((header, index) => currentHeaders[index] !== header);
        if (needsUpdate) {
          await this.writeHeaders();
        }
      }
    }

    this.initialized = true;
  }

  private async writeHeaders(): Promise<void> {
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.sheetId,
      range: `${this.sheetName}!A1:${this.columnLetter(HEADERS.length)}1`,
      valueInputOption: 'RAW',
      requestBody: { values: [HEADERS] },
    });
  }

  private columnLetter(index: number): string {
    let dividend = index;
    let columnName = '';
    while (dividend > 0) {
      const modulo = (dividend - 1) % 26;
      columnName = String.fromCharCode(65 + modulo) + columnName;
      dividend = Math.floor((dividend - modulo) / 26);
    }
    return columnName;
  }

  private padRow(row: string[]): string[] {
    const padded = [...row];
    while (padded.length < HEADERS.length) {
      padded.push('');
    }
    return padded;
  }

  private extractUrlFromCell(value: string | null | undefined): string {
    if (value === undefined || value === null) return '';
    const stringValue = String(value).trim();
    if (!stringValue) return '';

    const hyperlinkMatch = stringValue.match(/(?:HYPERLINK|HIPERVINCULO)\s*\(\s*"([^"]+)"/i);
    if (hyperlinkMatch) return hyperlinkMatch[1];

    const urlMatch = stringValue.match(/https?:\/\/[^\s"')]+/i);
    if (urlMatch) return urlMatch[0];

    return '';
  }

  private buildRowFromData(data: Record<string, unknown>, existingRow: string[] | null = null): string[] {
    const baseRow = existingRow ? [...existingRow] : new Array(HEADERS.length).fill('');

    const updates: Record<string, string> = {
      'Fecha de Procesamiento': String(data.processedAt || new Date().toISOString()),
      'Fecha del Email': String(data.emailDate || 'N/A'),
      'Asunto': String(data.subject || 'N/A'),
      'Ubicacion': String(data.location || 'No disponible'),
      'Descripcion': String(data.description || 'No disponible'),
      'Resumen': String(data.summary || 'No disponible'),
      'Categoria': String(data.category || 'No clasificado'),
      'Prioridad': String(data.priority || 'Medium'),
      'Archivo PDF': String(data.pdfFilename || data.pdfFileName || 'N/A'),
      'Ver PDF': String(data.pdfLink || 'N/A'),
      'Fecha Site Visit': String(data.siteVisitDate || 'No disponible'),
      'Hora Site Visit': String(data.siteVisitTime || 'No disponible'),
      'Lugar de Visita': String(data.visitLocation || 'No disponible'),
      'Nombre Contacto': String(data.contactName || 'No disponible'),
      'Telefono Contacto': String(data.contactPhone || 'No disponible'),
      'Fecha Cierre Licitacion': String(data.biddingCloseDate || 'No disponible'),
      'Hora Cierre Licitacion': String(data.biddingCloseTime || 'No disponible'),
      'Metodo Extraccion': String(data.extractionMethod || 'Regex'),
      'Email ID': String(data.emailId || existingRow?.[HEADERS.indexOf('Email ID')] || 'N/A'),
    };

    if (data.approvalStatus !== undefined || !existingRow) {
      updates['Approval Status'] = String(data.approvalStatus || DEFAULT_STATUS);
    }
    if (data.approvalNotes !== undefined || !existingRow) {
      updates['Approval Notes'] = String(data.approvalNotes || '');
    }
    if (data.interested !== undefined || !existingRow) {
      updates['Interested'] = data.interested ? 'TRUE' : 'FALSE';
    }
    if (data.decisionStatus !== undefined || !existingRow) {
      updates['Decision Status'] = String(data.decisionStatus || DEFAULT_DECISION_STATUS);
    }
    if (data.title !== undefined || !existingRow) {
      updates['Titulo'] = String(data.title || '');
    }

    Object.entries(updates).forEach(([key, value]) => {
      const colIndex = HEADERS.indexOf(key);
      if (colIndex >= 0) baseRow[colIndex] = value;
    });

    return baseRow;
  }

  async appendLicitacionData(data: Record<string, unknown>): Promise<unknown> {
    await this.ensureInitialized();
    const row = this.buildRowFromData(data);

    const response = await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.sheetId,
      range: `${this.sheetName}!A:${this.columnLetter(HEADERS.length)}`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });

    return response.data;
  }

  async upsertLicitacion(data: Record<string, unknown>): Promise<{ rowNumber: number; data?: string[] }> {
    await this.ensureInitialized();

    const emailId = data.emailId as string;
    if (!emailId) throw new Error('emailId is required to upsert licitación');

    const { rowNumber, rowValues } = await this.findRowByEmailId(emailId);

    if (rowNumber) {
      const updatedRow = this.buildRowFromData(data, rowValues);
      await this.writeRow(rowNumber, updatedRow);
      return { rowNumber, data: updatedRow };
    }

    await this.appendLicitacionData(data);
    const lastRow = await this.getLastRowNumber();
    return { rowNumber: lastRow };
  }

  async getLicitaciones(filters: Filters = {}): Promise<Licitacion[]> {
    await this.ensureInitialized();

    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.sheetId,
      range: `${this.sheetName}!A2:${this.columnLetter(HEADERS.length)}`,
      valueRenderOption: 'FORMULA',
      majorDimension: 'ROWS',
    });

    const rows = response.data.values || [];

    const licitaciones: Licitacion[] = rows.map((row, index) => {
      const paddedRow = this.padRow(row as string[]);
      const lic: Record<string, unknown> = {};

      HEADERS.forEach((header, colIndex) => {
        lic[this.keyFromHeader(header)] = paddedRow[colIndex] ?? '';
      });

      lic.pdfUrl = this.extractUrlFromCell(lic.pdfLink as string);
      lic.rowNumber = index + 2;
      lic.id = lic.rowNumber;
      lic.approvalStatus = (lic.approvalStatus as string) || DEFAULT_STATUS;
      lic.decisionStatus = (lic.decisionStatus as string) || DEFAULT_DECISION_STATUS;
      lic.interested = this.parseBoolean(lic.interested);

      const biddingDate = this.parseDateValue(lic.biddingCloseDate as string);
      if (biddingDate) lic.biddingCloseDate = this.formatDateLocal(biddingDate);

      const siteVisitDateParsed = this.parseDateValue(lic.siteVisitDate as string);
      if (siteVisitDateParsed) lic.siteVisitDate = this.formatDateLocal(siteVisitDateParsed);

      const biddingTime = this.formatTimeValue(lic.biddingCloseTime as string);
      if (biddingTime) lic.biddingCloseTime = biddingTime;

      const siteVisitTime = this.formatTimeValue(lic.siteVisitTime as string);
      if (siteVisitTime) lic.siteVisitTime = siteVisitTime;

      return lic as unknown as Licitacion;
    });

    // Auto-reject pending licitaciones with passed close dates or visit dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const updatePromises: Promise<void>[] = [];
    licitaciones.forEach((lic) => {
      if (lic.approvalStatus === 'pending') {
        let shouldReject = false;
        let rejectReason = '';

        if (lic.biddingCloseDate && lic.biddingCloseDate !== 'No disponible') {
          try {
            const closeDate = new Date(lic.biddingCloseDate);
            closeDate.setHours(23, 59, 59, 999);
            if (closeDate < today) {
              shouldReject = true;
              rejectReason = '[Auto-rechazado: fecha de cierre vencida]';
            }
          } catch { /* ignore */ }
        }

        if (!shouldReject && lic.siteVisitDate && lic.siteVisitDate !== 'No disponible') {
          try {
            const visitDate = new Date(lic.siteVisitDate);
            visitDate.setHours(23, 59, 59, 999);
            if (visitDate < today) {
              shouldReject = true;
              rejectReason = '[Auto-rechazado: fecha de visita vencida]';
            }
          } catch { /* ignore */ }
        }

        if (shouldReject) {
          lic.approvalStatus = 'rejected';
          lic.approvalNotes = lic.approvalNotes
            ? `${lic.approvalNotes}\n${rejectReason}`
            : rejectReason;

          updatePromises.push(
            this.updateApprovalStatus(lic.rowNumber, 'rejected', lic.approvalNotes)
              .then(() => {})
              .catch((err) => console.error(`Error auto-rejecting row ${lic.rowNumber}:`, err))
          );
        }
      }
    });

    if (updatePromises.length > 0) {
      Promise.all(updatePromises).catch((err) =>
        console.error('Some auto-reject updates failed:', err)
      );
    }

    // Hide auto-rejected (expired) licitaciones from API response
    const visibleLicitaciones = licitaciones.filter((lic) => {
      const notes = (lic.approvalNotes || '').toString();
      return !notes.includes('[Auto-rechazado');
    });

    const sortedLicitaciones = visibleLicitaciones.reverse();
    return this.applyFilters(sortedLicitaciones, filters);
  }

  async getLicitacionByRow(rowNumber: number): Promise<Licitacion | null> {
    await this.ensureInitialized();

    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.sheetId,
      range: `${this.sheetName}!A${rowNumber}:${this.columnLetter(HEADERS.length)}${rowNumber}`,
      valueRenderOption: 'FORMULA',
    });

    const rows = response.data.values || [];
    if (rows.length === 0) return null;

    const paddedRow = this.padRow(rows[0] as string[]);
    const lic: Record<string, unknown> = {};

    HEADERS.forEach((header, colIndex) => {
      lic[this.keyFromHeader(header)] = paddedRow[colIndex] ?? '';
    });

    lic.pdfUrl = this.extractUrlFromCell(lic.pdfLink as string);
    lic.rowNumber = rowNumber;
    lic.id = rowNumber;
    lic.approvalStatus = (lic.approvalStatus as string) || DEFAULT_STATUS;
    lic.decisionStatus = (lic.decisionStatus as string) || DEFAULT_DECISION_STATUS;
    lic.interested = this.parseBoolean(lic.interested);

    const biddingDate = this.parseDateValue(lic.biddingCloseDate as string);
    if (biddingDate) lic.biddingCloseDate = this.formatDateLocal(biddingDate);

    const siteVisitDateParsed = this.parseDateValue(lic.siteVisitDate as string);
    if (siteVisitDateParsed) lic.siteVisitDate = this.formatDateLocal(siteVisitDateParsed);

    const biddingTime = this.formatTimeValue(lic.biddingCloseTime as string);
    if (biddingTime) lic.biddingCloseTime = biddingTime;

    const siteVisitTime = this.formatTimeValue(lic.siteVisitTime as string);
    if (siteVisitTime) lic.siteVisitTime = siteVisitTime;

    return lic as unknown as Licitacion;
  }

  async updateApprovalStatus(rowNumber: number, status: string, notes = ''): Promise<Licitacion | null> {
    const current = await this.getLicitacionByRow(rowNumber);
    if (!current) throw new Error(`Licitación with row ${rowNumber} not found`);

    const updated: Record<string, unknown> = { ...current };
    updated.approvalStatus = status;
    updated.approvalNotes = notes;

    if (status === 'approved') {
      updated.decisionStatus = 'approved';
    } else if (status === 'rejected') {
      updated.decisionStatus = 'rejected';
    } else {
      updated.decisionStatus = current.decisionStatus || DEFAULT_DECISION_STATUS;
    }

    await this.writeRow(rowNumber, this.buildRowFromData(updated, this.rowFromObject(current)));
    return this.getLicitacionByRow(rowNumber);
  }

  async deleteLicitacion(rowNumber: number): Promise<{ success: boolean; deletedRow: number; subject: string }> {
    await this.ensureInitialized();

    const current = await this.getLicitacionByRow(rowNumber);
    if (!current) throw new Error(`Licitación with row ${rowNumber} not found`);

    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.sheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: 0,
                dimension: 'ROWS',
                startIndex: rowNumber - 1,
                endIndex: rowNumber,
              },
            },
          },
        ],
      },
    });

    return { success: true, deletedRow: rowNumber, subject: current.subject };
  }

  async getStats(): Promise<{ total: number; pending: number; approved: number; rejected: number }> {
    const data = await this.getLicitaciones();

    const total = data.length;
    const pending = data.filter((lic) => (lic.approvalStatus || '').toLowerCase() === 'pending').length;
    const approved = data.filter((lic) => (lic.approvalStatus || '').toLowerCase() === 'approved').length;
    const rejected = data.filter((lic) => (lic.approvalStatus || '').toLowerCase() === 'rejected').length;

    return { total, pending, approved, rejected };
  }

  async getDistinctFilterValues(): Promise<{ towns: string[]; categories: string[] }> {
    const licitaciones = await this.getLicitaciones();

    const townSet = new Set<string>();
    const categorySet = new Set<string>();

    for (const lic of licitaciones) {
      const loc = (lic.location || '').trim();
      if (loc && loc.toLowerCase() !== 'no disponible') townSet.add(loc);
      const cat = (lic.category || '').trim();
      if (cat && cat.toLowerCase() !== 'no clasificado') categorySet.add(cat);
    }

    const collator = new Intl.Collator('es', { sensitivity: 'base' });
    return {
      towns: [...townSet].sort(collator.compare),
      categories: [...categorySet].sort(collator.compare),
    };
  }

  async getSiteVisitEvents(filters: Filters = {}): Promise<unknown[]> {
    const licitaciones = await this.getLicitaciones(filters);

    const events = licitaciones
      .map((lic) => {
        const visitDate = this.parseDateValue(lic.siteVisitDate);
        if (!visitDate) return null;

        const visitTime = this.formatTimeValue(lic.siteVisitTime);
        const isoDate = this.formatDateLocal(visitDate);

        return {
          id: lic.id,
          rowNumber: lic.rowNumber,
          subject: lic.subject || 'Sin título',
          title: lic.title,
          location: lic.location || 'No disponible',
          visitLocation: normalizeVisitLocationLabel(lic.visitLocation) || 'No disponible',
          category: lic.category || 'No clasificado',
          approvalStatus: lic.approvalStatus || DEFAULT_STATUS,
          decisionStatus: lic.decisionStatus || DEFAULT_DECISION_STATUS,
          visitDate: isoDate,
          visitTime,
          rawVisitDate: lic.siteVisitDate,
          rawVisitTime: lic.siteVisitTime,
          pdfLink: lic.pdfLink,
          pdfUrl: this.extractUrlFromCell(lic.pdfLink),
          pdfFilename: lic.pdfFilename,
          emailDate: lic.emailDate,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const aDate = new Date(`${a!.visitDate}T${a!.visitTime || '00:00'}:00`);
        const bDate = new Date(`${b!.visitDate}T${b!.visitTime || '00:00'}:00`);
        return aDate.getTime() - bDate.getTime();
      });

    return events;
  }

  private async getLastRowNumber(): Promise<number> {
    await this.ensureInitialized();
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.sheetId,
      range: `${this.sheetName}!A:A`,
    });
    const values = response.data.values;
    return values ? values.length : 0;
  }

  private keyFromHeader(header: string): string {
    if (HEADER_KEY_MAP[header]) return HEADER_KEY_MAP[header];
    return header
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+(.)/g, (_, char: string) => char.toUpperCase());
  }

  private parseBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true' || value === '1' || value === '✅';
    }
    return false;
  }

  private applyFilters(licitaciones: Licitacion[], filters: Filters): Licitacion[] {
    let result = [...licitaciones];

    if (filters.status) {
      result = result.filter(
        (lic) => (lic.approvalStatus || '').toLowerCase() === filters.status!.toLowerCase()
      );
    }

    if (filters.category) {
      result = result.filter(
        (lic) => (lic.category || '').toLowerCase() === filters.category!.toLowerCase()
      );
    }

    if (filters.type) {
      if (filters.type === 'visits') {
        result = result.filter((lic) => {
          const location = (lic.visitLocation || '').toString().trim();
          return location && location.toLowerCase() !== 'no disponible';
        });
      } else if (filters.type === 'purchases') {
        result = result.filter((lic) => {
          const location = (lic.visitLocation || '').toString().trim();
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

    if (filters.interested !== undefined) {
      const interestedBool = filters.interested === 'true';
      result = result.filter((lic) => lic.interested === interestedBool);
    }

    if (filters.dateRange) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      result = result.filter((lic) => {
        const visitDate = this.parseDateValue(lic.siteVisitDate);
        if (!visitDate) return false;

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

  private async findRowByEmailId(emailId: string): Promise<{ rowNumber: number | null; rowValues: string[] | null }> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.sheetId,
      range: `${this.sheetName}!A2:${this.columnLetter(HEADERS.length)}`,
      valueRenderOption: 'FORMULA',
      majorDimension: 'ROWS',
    });

    const rows = response.data.values || [];
    const emailIndex = HEADERS.indexOf('Email ID');

    for (let i = 0; i < rows.length; i++) {
      const row = this.padRow(rows[i] as string[]);
      if ((row[emailIndex] || '').trim() === emailId) {
        return { rowNumber: i + 2, rowValues: row };
      }
    }

    return { rowNumber: null, rowValues: null };
  }

  private async writeRow(rowNumber: number, rowValues: string[]): Promise<void> {
    const range = `${this.sheetName}!A${rowNumber}:${this.columnLetter(HEADERS.length)}${rowNumber}`;
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.sheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [rowValues] },
    });
  }

  private rowFromObject(obj: Licitacion): string[] {
    return HEADERS.map((header) => {
      const key = this.keyFromHeader(header);
      const val = (obj as unknown as Record<string, unknown>)[key];
      return val !== undefined && val !== null ? String(val) : '';
    });
  }

  parseDateValue(value: string | null | undefined): Date | null {
    if (value === undefined || value === null) return null;

    const stringValue = String(value).trim();
    if (!stringValue || stringValue.toLowerCase() === 'no disponible') return null;

    const numericValue = Number(stringValue);
    if (!Number.isNaN(numericValue) && numericValue > 0) {
      const milliseconds = Math.round((numericValue - 25569) * 86400 * 1000);
      const dateFromSerial = new Date(milliseconds);
      if (!Number.isNaN(dateFromSerial.getTime())) return dateFromSerial;
    }

    const parsed = new Date(stringValue);
    if (!Number.isNaN(parsed.getTime())) return parsed;

    return null;
  }

  formatDateLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatTimeValue(value: string | null | undefined): string | null {
    if (value === undefined || value === null) return null;

    let stringValue = String(value).trim();
    if (!stringValue || stringValue.toLowerCase() === 'no disponible') return null;

    const numericValue = Number(stringValue);
    if (!Number.isNaN(numericValue) && numericValue >= 0 && numericValue < 24) {
      const totalMinutes =
        numericValue < 1 ? Math.round(numericValue * 24 * 60) : Math.round(numericValue * 60);
      const hours = Math.floor(totalMinutes / 60) % 24;
      const minutes = totalMinutes % 60;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    const sanitized = stringValue
      .replace(/a\.?\s*m\.?/gi, 'AM')
      .replace(/p\.?\s*m\.?/gi, 'PM')
      .replace(/[()]/g, ' ')
      .replace(/[,.;]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const firstTokenMatch = sanitized.match(/(\d{1,2}[:.]\d{2}\s*(?:AM|PM)?)/i);
    const target = firstTokenMatch ? firstTokenMatch[1] : sanitized;

    const amPmMatch = target.match(/^(\d{1,2})[:.](\d{2})\s*(AM|PM)$/i);
    if (amPmMatch) {
      let hours = parseInt(amPmMatch[1], 10);
      const minutes = amPmMatch[2];
      const period = amPmMatch[3].toUpperCase();
      if (period === 'PM' && hours < 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      return `${String(hours).padStart(2, '0')}:${minutes}`;
    }

    const hourPeriodMatch = target.match(/^(\d{1,2})\s*(AM|PM)$/i);
    if (hourPeriodMatch) {
      let hours = parseInt(hourPeriodMatch[1], 10);
      const period = hourPeriodMatch[2].toUpperCase();
      if (period === 'PM' && hours < 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      return `${String(hours).padStart(2, '0')}:00`;
    }

    const standardMatch = target.match(/^(\d{1,2})[:.](\d{2})(?::(\d{2}))?$/);
    if (standardMatch) {
      const hours = parseInt(standardMatch[1], 10);
      const minutes = standardMatch[2];
      return `${String(hours % 24).padStart(2, '0')}:${minutes}`;
    }

    return null;
  }
}

export default SheetsService;
