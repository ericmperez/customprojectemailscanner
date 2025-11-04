import { google } from 'googleapis';
import { normalizeVisitLocationLabel, normalizeVisitLocationFilterValue } from './visit-location.utils.js';

// Read config directly from environment variables
const config = {
  gmail: {
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    redirectUri: process.env.GMAIL_REDIRECT_URI,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN,
  },
  sheets: {
    sheetId: process.env.GOOGLE_SHEET_ID,
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
];

const HEADER_KEY_MAP = {
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
};

const DEFAULT_STATUS = 'pending';
const DEFAULT_DECISION_STATUS = 'researching';

class SheetsService {
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
    this.initialized = false;
  }

  async ensureInitialized() {
    if (this.initialized) {
      return;
    }

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetId,
        range: `${this.sheetName}!A1:${this._columnLetter(HEADERS.length)}1`,
      });

      const values = response.data.values;

      if (!values || values.length === 0) {
        await this._writeHeaders();
        console.log('Initialized sheet with headers');
      } else {
        const currentHeaders = values[0];
        if (currentHeaders.length < HEADERS.length) {
          await this._writeHeaders();
          console.log('Updated sheet headers with new columns');
        } else {
          // Ensure headers match expected values (non-destructive)
          const needsUpdate = HEADERS.some((header, index) => currentHeaders[index] !== header);
          if (needsUpdate) {
            await this._writeHeaders();
            console.log('Normalized sheet headers');
          }
        }
      }

      this.initialized = true;
    } catch (error) {
      console.error('Error ensuring sheet initialization:', error);
      throw error;
    }
  }

  async _writeHeaders() {
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.sheetId,
      range: `${this.sheetName}!A1:${this._columnLetter(HEADERS.length)}1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [HEADERS],
      },
    });
  }

  _columnLetter(index) {
    let dividend = index;
    let columnName = '';

    while (dividend > 0) {
      let modulo = (dividend - 1) % 26;
      columnName = String.fromCharCode(65 + modulo) + columnName;
      dividend = Math.floor((dividend - modulo) / 26);
    }

    return columnName;
  }

  _padRow(row) {
    const padded = [...row];
    while (padded.length < HEADERS.length) {
      padded.push('');
    }
    return padded;
  }

  _extractUrlFromCell(value) {
    if (value === undefined || value === null) {
      return '';
    }

    const stringValue = String(value).trim();
    if (!stringValue) {
      return '';
    }

    const hyperlinkMatch = stringValue.match(/(?:HYPERLINK|HIPERVINCULO)\s*\(\s*"([^"]+)"/i);
    if (hyperlinkMatch) {
      return hyperlinkMatch[1];
    }

    const urlMatch = stringValue.match(/https?:\/\/[^\s"')]+/i);
    if (urlMatch) {
      return urlMatch[0];
    }

    return '';
  }

  _buildRowFromData(data, existingRow = null) {
    const baseRow = existingRow ? [...existingRow] : new Array(HEADERS.length).fill('');

    const updates = {
      'Fecha de Procesamiento': data.processedAt || new Date().toISOString(),
      'Fecha del Email': data.emailDate || 'N/A',
      'Asunto': data.subject || 'N/A',
      'Ubicacion': data.location || 'No disponible',
      'Descripcion': data.description || 'No disponible',
      'Resumen': data.summary || 'No disponible',
      'Categoria': data.category || 'No clasificado',
      'Prioridad': data.priority || 'Medium',
      'Archivo PDF': data.pdfFilename || data.pdfFileName || 'N/A',
      'Ver PDF': data.pdfLink || 'N/A',
      'Fecha Site Visit': data.siteVisitDate || 'No disponible',
      'Hora Site Visit': data.siteVisitTime || 'No disponible',
      'Lugar de Visita': data.visitLocation || 'No disponible',
      'Nombre Contacto': data.contactName || 'No disponible',
      'Telefono Contacto': data.contactPhone || 'No disponible',
      'Fecha Cierre Licitacion': data.biddingCloseDate || 'No disponible',
      'Hora Cierre Licitacion': data.biddingCloseTime || 'No disponible',
      'Metodo Extraccion': data.extractionMethod || 'Regex',
      'Email ID': data.emailId || existingRow?.[HEADERS.indexOf('Email ID')] || 'N/A',
    };

    if (data.approvalStatus !== undefined || !existingRow) {
      updates['Approval Status'] = data.approvalStatus || DEFAULT_STATUS;
    }

    if (data.approvalNotes !== undefined || !existingRow) {
      updates['Approval Notes'] = data.approvalNotes || '';
    }

    if (data.interested !== undefined || !existingRow) {
      const interestedValue = data.interested !== undefined ? (data.interested ? 'TRUE' : 'FALSE') : 'FALSE';
      updates['Interested'] = interestedValue;
    }

    if (data.decisionStatus !== undefined || !existingRow) {
      updates['Decision Status'] = data.decisionStatus || DEFAULT_DECISION_STATUS;
    }

    Object.entries(updates).forEach(([key, value]) => {
      const colIndex = HEADERS.indexOf(key);
      if (colIndex >= 0) {
        baseRow[colIndex] = value;
      }
    });

    return baseRow;
  }

  async appendLicitacionData(data) {
    await this.ensureInitialized();

    const row = this._buildRowFromData(data);

    const response = await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.sheetId,
      range: `${this.sheetName}!A:${this._columnLetter(HEADERS.length)}`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [row],
      },
    });

    console.log('Appended row to Google Sheets', {
      updatedRange: response.data.updates?.updatedRange,
      updatedRows: response.data.updates?.updatedRows,
    });

    return response.data;
  }

  async upsertLicitacion(data) {
    await this.ensureInitialized();

    const emailId = data.emailId;
    if (!emailId) {
      throw new Error('emailId is required to upsert licitación');
    }

    const { rowNumber, rowValues } = await this._findRowByEmailId(emailId);

    if (rowNumber) {
      const updatedRow = this._buildRowFromData(data, rowValues);
      await this._writeRow(rowNumber, updatedRow);
      return { rowNumber, data: updatedRow };
    }

    await this.appendLicitacionData(data);
    const lastRow = await this.getLastRowNumber();
    return { rowNumber: lastRow };
  }

  async getLicitaciones(filters = {}) {
    await this.ensureInitialized();

    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.sheetId,
      range: `${this.sheetName}!A2:${this._columnLetter(HEADERS.length)}`,
      valueRenderOption: 'FORMULA',
      majorDimension: 'ROWS',
    });

    const rows = response.data.values || [];

    const licitaciones = rows.map((row, index) => {
      const paddedRow = this._padRow(row);
      const lic = {};

      HEADERS.forEach((header, colIndex) => {
        lic[this._keyFromHeader(header)] = paddedRow[colIndex] ?? '';
      });

      lic.pdfUrl = this._extractUrlFromCell(lic.pdfLink);

      lic.rowNumber = index + 2;
      lic.id = lic.rowNumber;
      lic.approvalStatus = lic.approvalStatus || DEFAULT_STATUS;
      lic.decisionStatus = lic.decisionStatus || DEFAULT_DECISION_STATUS;
      lic.interested = this._parseBoolean(lic.interested);

      // Format dates from serial numbers to readable format
      const biddingDate = this._parseDateValue(lic.biddingCloseDate);
      if (biddingDate) {
        lic.biddingCloseDate = this._formatDateLocal(biddingDate);
      }

      const siteVisitDateParsed = this._parseDateValue(lic.siteVisitDate);
      if (siteVisitDateParsed) {
        lic.siteVisitDate = this._formatDateLocal(siteVisitDateParsed);
      }

      // Format times from decimal/serial numbers to HH:MM format
      const biddingTime = this._formatTimeValue(lic.biddingCloseTime);
      if (biddingTime) {
        lic.biddingCloseTime = biddingTime;
      }

      const siteVisitTime = this._formatTimeValue(lic.siteVisitTime);
      if (siteVisitTime) {
        lic.siteVisitTime = siteVisitTime;
      }

      return lic;
    });

    // Auto-reject pending licitaciones with passed close dates or visit dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const updatePromises = [];
    licitaciones.forEach(lic => {
      if (lic.approvalStatus === 'pending') {
        let shouldReject = false;
        let rejectReason = '';
        
        // Check bidding close date
        if (lic.biddingCloseDate && lic.biddingCloseDate !== 'No disponible') {
          try {
            const closeDate = new Date(lic.biddingCloseDate);
            closeDate.setHours(23, 59, 59, 999);
            
            if (closeDate < today) {
              shouldReject = true;
              rejectReason = '[Auto-rechazado: fecha de cierre vencida]';
              console.log(`Auto-rejecting expired licitación: ${lic.subject} (closed: ${lic.biddingCloseDate})`);
            }
          } catch (err) {
            console.error(`Error checking close date for ${lic.subject}:`, err);
          }
        }
        
        // Check visit date
        if (!shouldReject && lic.siteVisitDate && lic.siteVisitDate !== 'No disponible') {
          try {
            const visitDate = new Date(lic.siteVisitDate);
            visitDate.setHours(23, 59, 59, 999);
            
            if (visitDate < today) {
              shouldReject = true;
              rejectReason = '[Auto-rechazado: fecha de visita vencida]';
              console.log(`Auto-rejecting expired visit: ${lic.subject} (visit: ${lic.siteVisitDate})`);
            }
          } catch (err) {
            console.error(`Error checking visit date for ${lic.subject}:`, err);
          }
        }
        
        // Apply rejection if needed
        if (shouldReject) {
          lic.approvalStatus = 'rejected';
          lic.approvalNotes = lic.approvalNotes ? 
            `${lic.approvalNotes}\n${rejectReason}` : 
            rejectReason;
          
          // Update in sheet asynchronously (don't wait)
          updatePromises.push(
            this.updateApprovalStatus(lic.rowNumber, 'rejected', lic.approvalNotes)
              .catch(err => console.error(`Error auto-rejecting row ${lic.rowNumber}:`, err))
          );
        }
      }
    });

    // Don't wait for updates to complete, let them happen in background
    if (updatePromises.length > 0) {
      Promise.all(updatePromises).catch(err => 
        console.error('Some auto-reject updates failed:', err)
      );
    }

    // Reverse to show newest (highest row numbers) first
    const sortedLicitaciones = licitaciones.reverse();

    return this._applyFilters(sortedLicitaciones, filters);
  }

  async getLicitacionByRow(rowNumber) {
    await this.ensureInitialized();

    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.sheetId,
      range: `${this.sheetName}!A${rowNumber}:${this._columnLetter(HEADERS.length)}${rowNumber}`,
      valueRenderOption: 'FORMULA',
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      return null;
    }

    const paddedRow = this._padRow(rows[0]);
    const lic = {};

    HEADERS.forEach((header, colIndex) => {
      lic[this._keyFromHeader(header)] = paddedRow[colIndex] ?? '';
    });

    lic.pdfUrl = this._extractUrlFromCell(lic.pdfLink);

    lic.rowNumber = rowNumber;
    lic.id = rowNumber;
    lic.approvalStatus = lic.approvalStatus || DEFAULT_STATUS;
    lic.decisionStatus = lic.decisionStatus || DEFAULT_DECISION_STATUS;
    lic.interested = this._parseBoolean(lic.interested);

    // Format dates from serial numbers to readable format
    const biddingDate = this._parseDateValue(lic.biddingCloseDate);
    if (biddingDate) {
      lic.biddingCloseDate = this._formatDateLocal(biddingDate);
    }

    const siteVisitDateParsed = this._parseDateValue(lic.siteVisitDate);
    if (siteVisitDateParsed) {
      lic.siteVisitDate = this._formatDateLocal(siteVisitDateParsed);
    }

    // Format times from decimal/serial numbers to HH:MM format
    const biddingTime = this._formatTimeValue(lic.biddingCloseTime);
    if (biddingTime) {
      lic.biddingCloseTime = biddingTime;
    }

    const siteVisitTime = this._formatTimeValue(lic.siteVisitTime);
    if (siteVisitTime) {
      lic.siteVisitTime = siteVisitTime;
    }

    return lic;
  }

  async updateApprovalStatus(rowNumber, status, notes = '') {
    const current = await this.getLicitacionByRow(rowNumber);
    if (!current) {
      throw new Error(`Licitación with row ${rowNumber} not found`);
    }

    current.approvalStatus = status;
    current.approvalNotes = notes;

    if (status === 'approved') {
      current.decisionStatus = 'approved';
    } else if (status === 'rejected') {
      current.decisionStatus = 'rejected';
    } else {
      current.decisionStatus = current.decisionStatus || DEFAULT_DECISION_STATUS;
    }

    await this._writeRow(rowNumber, this._buildRowFromData(current, this._rowFromObject(current)));
    return this.getLicitacionByRow(rowNumber);
  }

  async updateFields(rowNumber, updates = {}) {
    const current = await this.getLicitacionByRow(rowNumber);
    if (!current) {
      throw new Error(`Licitación with row ${rowNumber} not found`);
    }

    const next = { ...current, ...updates };
    await this._writeRow(rowNumber, this._buildRowFromData(next, this._rowFromObject(current)));
    return this.getLicitacionByRow(rowNumber);
  }

  async deleteLicitacion(rowNumber) {
    await this.ensureInitialized();

    const current = await this.getLicitacionByRow(rowNumber);
    if (!current) {
      throw new Error(`Licitación with row ${rowNumber} not found`);
    }

    // Delete the row from the sheet
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.sheetId,
      resource: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: 0, // First sheet (adjust if needed)
                dimension: 'ROWS',
                startIndex: rowNumber - 1, // 0-indexed
                endIndex: rowNumber, // Exclusive
              },
            },
          },
        ],
      },
    });

    console.log(`Deleted licitación at row ${rowNumber}: ${current.subject}`);
    return { success: true, deletedRow: rowNumber, subject: current.subject };
  }

  async getStats() {
    const data = await this.getLicitaciones();

    const total = data.length;
    const pending = data.filter(lic => (lic.approvalStatus || '').toLowerCase() === 'pending').length;
    const approved = data.filter(lic => (lic.approvalStatus || '').toLowerCase() === 'approved').length;
    const rejected = data.filter(lic => (lic.approvalStatus || '').toLowerCase() === 'rejected').length;

    return { total, pending, approved, rejected };
  }

  async getSiteVisitEvents(filters = {}) {
    const licitaciones = await this.getLicitaciones(filters);

    const events = licitaciones
      .map(lic => {
        const visitDate = this._parseDateValue(lic.siteVisitDate);
        if (!visitDate) {
          return null;
        }

        const visitTime = this._formatTimeValue(lic.siteVisitTime);
        const isoDate = this._formatDateLocal(visitDate);

        return {
          id: lic.id,
          rowNumber: lic.rowNumber,
          subject: lic.subject || 'Sin título',
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
          pdfUrl: this._extractUrlFromCell(lic.pdfLink),
          pdfFilename: lic.pdfFilename,
          emailDate: lic.emailDate,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const aDate = new Date(`${a.visitDate}T${a.visitTime || '00:00'}:00`);
        const bDate = new Date(`${b.visitDate}T${b.visitTime || '00:00'}:00`);
        return aDate - bDate;
      });

    return events;
  }

  async getLastRowNumber() {
    await this.ensureInitialized();

    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.sheetId,
      range: `${this.sheetName}!A:A`,
    });

    const values = response.data.values;
    return values ? values.length : 0;
  }

  _keyFromHeader(header) {
    if (HEADER_KEY_MAP[header]) {
      return HEADER_KEY_MAP[header];
    }

    return header
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+(.)/g, (_, char) => char.toUpperCase());
  }

  _parseBoolean(value) {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true' || value === '1' || value === '✅';
    }
    return false;
  }

  _applyFilters(licitaciones, filters) {
    let result = [...licitaciones];

    if (filters.status) {
      result = result.filter(lic => (lic.approvalStatus || '').toLowerCase() === filters.status.toLowerCase());
    }

    if (filters.category) {
      result = result.filter(lic => (lic.category || '').toLowerCase() === filters.category.toLowerCase());
    }

    if (filters.priority) {
      result = result.filter(lic => (lic.priority || '').toLowerCase() === filters.priority.toLowerCase());
    }

    // Filter by type (visits or purchases)
    if (filters.type) {
      if (filters.type === 'visits') {
        // Show only licitaciones with visit location
        result = result.filter(lic => {
          const location = (lic.visitLocation || '').toString().trim();
          return location && location.toLowerCase() !== 'no disponible';
        });
      } else if (filters.type === 'purchases') {
        // Show only licitaciones without visit location
        result = result.filter(lic => {
          const location = (lic.visitLocation || '').toString().trim();
          return !location || location.toLowerCase() === 'no disponible';
        });
      }
    }

    if (filters.interested !== undefined) {
      const interestedBool = filters.interested === 'true' || filters.interested === true;
      result = result.filter(lic => lic.interested === interestedBool);
    }

    // Filter by date range
    if (filters.dateRange) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      result = result.filter(lic => {
        const visitDate = this._parseDateValue(lic.siteVisitDate);
        if (!visitDate) return false;

        const visitDateTime = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate());

        switch (filters.dateRange) {
          case 'today':
            return visitDateTime.getTime() === today.getTime();
          
          case 'this-week': {
            const dayOfWeek = today.getDay();
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - dayOfWeek);
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            return visitDateTime >= startOfWeek && visitDateTime <= endOfWeek;
          }
          
          case 'next-week': {
            const nextWeekStart = new Date(today);
            nextWeekStart.setDate(today.getDate() + (7 - today.getDay()));
            const nextWeekEnd = new Date(nextWeekStart);
            nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
            return visitDateTime >= nextWeekStart && visitDateTime <= nextWeekEnd;
          }
          
          case 'next-2-weeks': {
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

  async _findRowByEmailId(emailId) {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.sheetId,
      range: `${this.sheetName}!A2:${this._columnLetter(HEADERS.length)}`,
      valueRenderOption: 'FORMULA',
      majorDimension: 'ROWS',
    });

    const rows = response.data.values || [];
    const emailIndex = HEADERS.indexOf('Email ID');

    for (let i = 0; i < rows.length; i++) {
      const row = this._padRow(rows[i]);
      if ((row[emailIndex] || '').trim() === emailId) {
        return { rowNumber: i + 2, rowValues: row };
      }
    }

    return { rowNumber: null, rowValues: null };
  }

  async _writeRow(rowNumber, rowValues) {
    const range = `${this.sheetName}!A${rowNumber}:${this._columnLetter(HEADERS.length)}${rowNumber}`;
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.sheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowValues],
      },
    });
  }

  _rowFromObject(obj) {
    return HEADERS.map(header => obj[this._keyFromHeader(header)] ?? '');
  }

  _parseDateValue(value) {
    if (value === undefined || value === null) {
      return null;
    }

    const stringValue = String(value).trim();
    if (!stringValue || stringValue.toLowerCase() === 'no disponible') {
      return null;
    }

    const numericValue = Number(stringValue);
    if (!Number.isNaN(numericValue) && numericValue > 0) {
      const milliseconds = Math.round((numericValue - 25569) * 86400 * 1000);
      const dateFromSerial = new Date(milliseconds);
      if (!Number.isNaN(dateFromSerial.getTime())) {
        return dateFromSerial;
      }
    }

    const parsed = new Date(stringValue);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }

    return null;
  }

  _formatDateLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  _formatTimeValue(value) {
    if (value === undefined || value === null) {
      return null;
    }

    let stringValue = String(value).trim();
    if (!stringValue || stringValue.toLowerCase() === 'no disponible') {
      return null;
    }

    const numericValue = Number(stringValue);
    if (!Number.isNaN(numericValue) && numericValue >= 0 && numericValue < 24) {
      const totalMinutes = numericValue < 1
        ? Math.round(numericValue * 24 * 60)
        : Math.round(numericValue * 60);
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
      if (period === 'PM' && hours < 12) {
        hours += 12;
      }
      if (period === 'AM' && hours === 12) {
        hours = 0;
      }
      return `${String(hours).padStart(2, '0')}:${minutes}`;
    }

    const hourPeriodMatch = target.match(/^(\d{1,2})\s*(AM|PM)$/i);
    if (hourPeriodMatch) {
      let hours = parseInt(hourPeriodMatch[1], 10);
      const period = hourPeriodMatch[2].toUpperCase();
      if (period === 'PM' && hours < 12) {
        hours += 12;
      }
      if (period === 'AM' && hours === 12) {
        hours = 0;
      }
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

