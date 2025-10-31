import { google } from 'googleapis';
import { config } from '../config/credentials.js';
import logger from '../utils/logger.js';

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
  }

  /**
   * Initialize sheet with headers if it's empty
   */
  async initializeSheet() {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetId,
        range: `${this.sheetName}!A1:N1`,
      });

      const values = response.data.values;

      // If sheet is empty, add headers
      if (!values || values.length === 0) {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.sheetId,
          range: `${this.sheetName}!A1:O1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[
              'Fecha de Procesamiento',
              'Fecha del Email',
              'Asunto',
              'Ubicación',
              'Descripción',
              'Resumen',
              'Archivo PDF',
              'Ver PDF',
              'Fecha Site Visit',
              'Hora Site Visit',
              'Lugar de Visita',
              'Nombre Contacto',
              'Teléfono Contacto',
              'Fecha Cierre Licitación',
              'Hora Cierre Licitación',
            ]],
          },
        });

        logger.info('Initialized sheet with headers');
      }
    } catch (error) {
      logger.error('Error initializing sheet:', error);
      throw error;
    }
  }

  /**
   * Append a new row with licitación data
   * @param {Object} data - Data to append
   */
  async appendLicitacionData(data) {
    try {
      const { 
        emailDate, 
        subject, 
        location, 
        description,
        summary,
        pdfFilename, 
        pdfLink,
        siteVisitDate,
        siteVisitTime,
        visitLocation,
        contactName,
        contactPhone,
        biddingCloseDate,
        biddingCloseTime,
        emailId 
      } = data;

      const row = [
        new Date().toISOString(), // Processing date
        emailDate || 'N/A',
        subject || 'N/A',
        location || 'No disponible',
        description || 'No disponible',
        summary || 'No disponible',
        pdfFilename || 'N/A',
        pdfLink || 'N/A', // PDF link (can be hyperlink formula)
        siteVisitDate || 'No disponible',
        siteVisitTime || 'No disponible',
        visitLocation || 'No disponible',
        contactName || 'No disponible',
        contactPhone || 'No disponible',
        biddingCloseDate || 'No disponible',
        biddingCloseTime || 'No disponible',
      ];

      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.sheetId,
        range: `${this.sheetName}!A:O`,
        valueInputOption: 'USER_ENTERED', // Changed to USER_ENTERED to support hyperlink formulas
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [row],
        },
      });

      logger.info('Appended row to Google Sheets', {
        updatedRange: response.data.updates.updatedRange,
        updatedRows: response.data.updates.updatedRows,
      });

      return response.data;
    } catch (error) {
      logger.error('Error appending to Google Sheets:', error);
      throw error;
    }
  }

  /**
   * Append multiple rows at once (batch operation)
   * @param {Array} dataArray - Array of data objects
   */
  async batchAppendLicitacionData(dataArray) {
    try {
      const rows = dataArray.map(data => [
        new Date().toISOString(), // Processing date
        data.emailDate || 'N/A',
        data.subject || 'N/A',
        data.location || 'No disponible',
        data.description || 'No disponible',
        data.summary || 'No disponible',
        data.pdfFilename || 'N/A',
        data.pdfLink || 'N/A',
        data.siteVisitDate || 'No disponible',
        data.siteVisitTime || 'No disponible',
        data.contactName || 'No disponible',
        data.contactPhone || 'No disponible',
        data.biddingCloseDate || 'No disponible',
        data.biddingCloseTime || 'No disponible',
      ]);

      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.sheetId,
        range: `${this.sheetName}!A:N`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: rows,
        },
      });

      logger.info(`Batch appended ${rows.length} rows to Google Sheets`, {
        updatedRange: response.data.updates.updatedRange,
        updatedRows: response.data.updates.updatedRows,
      });

      return response.data;
    } catch (error) {
      logger.error('Error batch appending to Google Sheets:', error);
      throw error;
    }
  }

  /**
   * Get the last row number in the sheet
   */
  async getLastRowNumber() {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetId,
        range: `${this.sheetName}!A:A`,
      });

      const values = response.data.values;
      return values ? values.length : 0;
    } catch (error) {
      logger.error('Error getting last row number:', error);
      return 0;
    }
  }
}

export default SheetsService;

