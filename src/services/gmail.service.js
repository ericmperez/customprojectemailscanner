import { google } from 'googleapis';
import { config } from '../config/credentials.js';
import logger from '../utils/logger.js';

class GmailService {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      config.gmail.clientId,
      config.gmail.clientSecret,
      config.gmail.redirectUri
    );

    this.oauth2Client.setCredentials({
      refresh_token: config.gmail.refreshToken,
    });

    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  /**
   * Search for emails with subject starting with "Licitación"
   * @param {Date} afterDate - Only get emails after this date
   * @returns {Promise<Array>} Array of message IDs
   */
  async searchLicitacionEmails(afterDate = null) {
    try {
      let query = 'subject:Licitación has:attachment filename:pdf';
      
      if (afterDate) {
        const dateStr = Math.floor(afterDate.getTime() / 1000);
        query += ` after:${dateStr}`;
      }

      logger.info('Searching Gmail with query:', { query });

      // Paginate through all results (not just first 50)
      let allMessages = [];
      let pageToken = null;

      do {
        const response = await this.gmail.users.messages.list({
          userId: 'me',
          q: query,
          maxResults: 500, // Max allowed by Gmail API
          pageToken: pageToken,
        });

        const messages = response.data.messages || [];
        allMessages = allMessages.concat(messages);
        pageToken = response.data.nextPageToken;

        logger.info(`Fetched ${messages.length} emails (total so far: ${allMessages.length})`);

      } while (pageToken);

      logger.info(`Found ${allMessages.length} emails matching criteria`);

      return allMessages;
    } catch (error) {
      logger.error('Error searching Gmail:', error);
      throw error;
    }
  }

  /**
   * Get full email details including attachments
   * @param {string} messageId - Gmail message ID
   * @returns {Promise<Object>} Email details with attachments
   */
  async getEmailDetails(messageId) {
    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      const message = response.data;
      const headers = message.payload.headers;

      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const from = headers.find(h => h.name === 'From')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';
      const receivedDate = new Date(parseInt(message.internalDate));

      logger.info(`Processing email: ${subject}`, { from, date });

      // Extract PDF attachments
      const attachments = await this.extractAttachments(message);

      return {
        id: messageId,
        subject,
        from,
        date,
        receivedDate,
        attachments,
      };
    } catch (error) {
      logger.error(`Error getting email details for ${messageId}:`, error);
      throw error;
    }
  }

  /**
   * Extract PDF attachments from email
   * @param {Object} message - Gmail message object
   * @returns {Promise<Array>} Array of attachment objects
   */
  async extractAttachments(message) {
    const attachments = [];

    const parts = message.payload.parts || [];
    
    for (const part of parts) {
      if (part.filename && part.filename.toLowerCase().endsWith('.pdf')) {
        const attachmentId = part.body.attachmentId;
        
        if (attachmentId) {
          try {
            const attachment = await this.gmail.users.messages.attachments.get({
              userId: 'me',
              messageId: message.id,
              id: attachmentId,
            });

            attachments.push({
              filename: part.filename,
              mimeType: part.mimeType,
              data: attachment.data.data, // Base64 encoded
              size: part.body.size,
            });

            logger.info(`Extracted PDF attachment: ${part.filename}`);
          } catch (error) {
            logger.error(`Error extracting attachment ${part.filename}:`, error);
          }
        }
      }
    }

    return attachments;
  }

  /**
   * Mark email as read (optional)
   * @param {string} messageId - Gmail message ID
   */
  async markAsRead(messageId) {
    try {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          removeLabelIds: ['UNREAD'],
        },
      });
      logger.info(`Marked email ${messageId} as read`);
    } catch (error) {
      logger.error(`Error marking email as read:`, error);
    }
  }
}

export default GmailService;

