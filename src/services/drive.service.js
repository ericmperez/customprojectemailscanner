import { google } from 'googleapis';
import { config } from '../config/credentials.js';
import logger from '../utils/logger.js';
import { Readable } from 'stream';

class DriveService {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      config.gmail.clientId,
      config.gmail.clientSecret,
      config.gmail.redirectUri
    );

    this.oauth2Client.setCredentials({
      refresh_token: config.gmail.refreshToken,
    });

    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
    this.folderId = null; // Will be set during initialization
  }

  /**
   * Initialize or get the Licitaciones folder in Google Drive
   * @returns {Promise<string>} Folder ID
   */
  async ensureLicitacionesFolder() {
    try {
      // Check if folder already exists
      const response = await this.drive.files.list({
        q: "name='Licitaciones PDFs' and mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields: 'files(id, name)',
        spaces: 'drive',
      });

      if (response.data.files && response.data.files.length > 0) {
        this.folderId = response.data.files[0].id;
        logger.info(`Using existing Licitaciones folder: ${this.folderId}`);
        return this.folderId;
      }

      // Create new folder
      const folderMetadata = {
        name: 'Licitaciones PDFs',
        mimeType: 'application/vnd.google-apps.folder',
      };

      const folder = await this.drive.files.create({
        requestBody: folderMetadata,
        fields: 'id',
      });

      this.folderId = folder.data.id;
      logger.info(`Created Licitaciones folder: ${this.folderId}`);
      return this.folderId;
    } catch (error) {
      logger.error('Error ensuring Licitaciones folder:', error);
      throw error;
    }
  }

  /**
   * Upload PDF to Google Drive
   * @param {Buffer} pdfBuffer - PDF file buffer
   * @param {string} filename - PDF filename
   * @returns {Promise<string>} Shareable link to the PDF
   */
  async uploadPDF(pdfBuffer, filename) {
    try {
      if (!this.folderId) {
        await this.ensureLicitacionesFolder();
      }

      const fileMetadata = {
        name: filename,
        parents: [this.folderId],
      };

      const media = {
        mimeType: 'application/pdf',
        body: Readable.from(pdfBuffer),
      };

      // Upload file
      const file = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, webViewLink',
      });

      const fileId = file.data.id;
      const webViewLink = file.data.webViewLink;

      // Make file publicly readable (anyone with link can view)
      await this.drive.permissions.create({
        fileId: fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });

      logger.info(`Uploaded PDF to Drive: ${filename}`, { fileId, webViewLink });
      
      return webViewLink;
    } catch (error) {
      logger.error(`Error uploading PDF ${filename} to Drive:`, error);
      // Return null if upload fails, so processing can continue
      return null;
    }
  }

  /**
   * Create a hyperlink formula for Google Sheets
   * @param {string} url - The URL to link to
   * @param {string} text - The display text
   * @returns {string} HYPERLINK formula
   */
  createHyperlinkFormula(url, text) {
    return `=HYPERLINK("${url}", "${text}")`;
  }
}

export default DriveService;

