import SheetsService from './sheets.service.js';

class LicitacionesService {
  constructor() {
    this.sheetsService = new SheetsService();
  }

  /**
   * Ensure Google Sheet has the correct headers
   */
  async ensureTableExists() {
    await this.sheetsService.ensureInitialized();
  }

  /**
   * Save or update a licitación record in Google Sheets
   */
  async saveLicitacion(data) {
    try {
      const result = await this.sheetsService.upsertLicitacion(data);
      console.log(`Saved licitación to Google Sheets: ${data.emailId}`);
      return result;
    } catch (error) {
      console.error('Error saving licitación:', error);
      throw error;
    }
  }

  /**
   * Get all licitaciones with optional filtering
   */
  async getAllLicitaciones(filters = {}) {
    try {
      const data = await this.sheetsService.getLicitaciones(filters);
      return data;
    } catch (error) {
      console.error('Error getting licitaciones:', error);
      throw error;
    }
  }

  /**
   * Get a single licitación by row number
   */
  async getLicitacionById(id) {
    try {
      const data = await this.sheetsService.getLicitacionByRow(Number(id));
      return data;
    } catch (error) {
      console.error(`Error getting licitación ${id}:`, error);
      throw error;
    }
  }

  /**
   * Update approval status
   */
  async updateApprovalStatus(id, status, notes = '') {
    try {
      const updated = await this.sheetsService.updateApprovalStatus(Number(id), status, notes);
      console.log(`Updated approval status for licitación ${id}: ${status}`);
      return updated;
    } catch (error) {
      console.error(`Error updating approval status for ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete a licitación
   */
  async deleteLicitacion(id) {
    try {
      const result = await this.sheetsService.deleteLicitacion(Number(id));
      console.log(`Deleted licitación ${id}`);
      return result;
    } catch (error) {
      console.error(`Error deleting licitación ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get dashboard statistics
   */
  async getStats() {
    try {
      const stats = await this.sheetsService.getStats();
      return stats;
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      return { total: 0, pending: 0, approved: 0, rejected: 0 };
    }
  }

  /**
   * Get licitations that have a scheduled site visit
   */
  async getSiteVisitEvents(filters = {}) {
    try {
      const events = await this.sheetsService.getSiteVisitEvents(filters);
      return events;
    } catch (error) {
      console.error('Error getting site visit events:', error);
      throw error;
    }
  }
}

export default LicitacionesService;

