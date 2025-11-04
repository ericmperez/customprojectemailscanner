import { createClient } from '@supabase/supabase-js';
import { config } from '../config/credentials.js';
import logger from '../utils/logger.js';
import path from 'path';
import crypto from 'crypto';

class SupabaseService {
  constructor() {
    this.supabase = createClient(config.supabase.url, config.supabase.key);
    this.tableName = 'processed_emails';
    this.pdfBucket = config.supabase.pdfBucket;
  }

  /**
   * Initialize the processed_emails table if it doesn't exist
   * Note: You need to create this table in Supabase manually or via migration
   * 
   * SQL to create table:
   * CREATE TABLE processed_emails (
   *   id SERIAL PRIMARY KEY,
   *   email_id VARCHAR(255) UNIQUE NOT NULL,
   *   subject TEXT,
   *   processed_at TIMESTAMP DEFAULT NOW(),
   *   location TEXT,
   *   description TEXT,
   *   pdf_filename TEXT
   * );
   * CREATE INDEX idx_email_id ON processed_emails(email_id);
   */
  async ensureTableExists() {
    try {
      // Try to select from the table to check if it exists
      const { error } = await this.supabase
        .from(this.tableName)
        .select('id')
        .limit(1);

      if (error && error.code === 'PGRST204') {
        logger.warn('Table processed_emails does not exist. Please create it in Supabase.');
        logger.info('SQL: CREATE TABLE processed_emails (id SERIAL PRIMARY KEY, email_id VARCHAR(255) UNIQUE NOT NULL, subject TEXT, processed_at TIMESTAMP DEFAULT NOW(), location TEXT, description TEXT, pdf_filename TEXT);');
      }
    } catch (error) {
      logger.error('Error checking table existence:', error);
    }
  }

  /**
   * Check if an email has been processed
   * @param {string} emailId - Gmail message ID
   * @returns {Promise<boolean>} True if already processed
   */
  async isEmailProcessed(emailId) {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('email_id')
        .eq('email_id', emailId)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "not found" error, which is expected
        throw error;
      }

      return !!data;
    } catch (error) {
      logger.error(`Error checking if email ${emailId} is processed:`, error);
      return false; // Assume not processed if error
    }
  }

  /**
   * Mark an email as processed
   * @param {Object} emailData - Email data to store
   */
  async markEmailAsProcessed(emailData) {
    try {
      const { emailId, subject, location, description, pdfFilename } = emailData;

      const { data, error } = await this.supabase
        .from(this.tableName)
        .insert([
          {
            email_id: emailId,
            subject,
            location,
            description,
            pdf_filename: pdfFilename,
          },
        ])
        .select();

      if (error) {
        throw error;
      }

      logger.info(`Marked email ${emailId} as processed`);
      return data;
    } catch (error) {
      logger.error(`Error marking email as processed:`, error);
      throw error;
    }
  }

  async uploadPdfToStorage(pdfBuffer, filename, emailId = '') {
    if (!this.pdfBucket) {
      logger.warn('Supabase PDF bucket not configured. Skipping PDF upload.');
      return null;
    }

    try {
      const objectPath = this._buildStoragePath(filename, emailId);

      const { error: uploadError } = await this.supabase
        .storage
        .from(this.pdfBucket)
        .upload(objectPath, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError) {
        logger.error(`Error uploading PDF to Supabase storage (${objectPath}):`, uploadError);
        return null;
      }

      const { data: publicData, error: publicError } = this.supabase
        .storage
        .from(this.pdfBucket)
        .getPublicUrl(objectPath);

      if (publicError) {
        logger.error(`Error retrieving public URL for Supabase PDF (${objectPath}):`, publicError);
        return { path: objectPath, publicUrl: null };
      }

      const publicUrl = publicData?.publicUrl || null;
      logger.info(`Uploaded PDF to Supabase storage: ${objectPath}`);

      return { path: objectPath, publicUrl };
    } catch (error) {
      logger.error('Unexpected error uploading PDF to Supabase storage:', error);
      return null;
    }
  }

  _buildStoragePath(filename = 'licitacion.pdf', emailId = '') {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const extension = this._ensurePdfExtension(filename);
    const baseName = this._slugify(path.basename(filename, path.extname(filename)) || 'licitacion');
    const emailToken = this._slugify(emailId) || crypto.randomUUID();
    const timestamp = now.toISOString().replace(/[:.]/g, '-');

    return `${year}/${month}/${emailToken}-${timestamp}-${baseName}${extension}`;
  }

  _ensurePdfExtension(filename) {
    const ext = (path.extname(filename) || '').toLowerCase();
    return ext === '.pdf' ? ext : '.pdf';
  }

  _slugify(value = '') {
    return value
      .toString()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
  }

  /**
   * Get all processed email IDs
   * @returns {Promise<Array<string>>} Array of processed email IDs
   */
  async getAllProcessedEmailIds() {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('email_id');

      if (error) {
        throw error;
      }

      return data.map(row => row.email_id);
    } catch (error) {
      logger.error('Error getting processed email IDs:', error);
      return [];
    }
  }

  /**
   * Get processing statistics
   * @returns {Promise<Object>} Stats object
   */
  async getProcessingStats() {
    try {
      const { count, error } = await this.supabase
        .from(this.tableName)
        .select('*', { count: 'exact', head: true });

      if (error) {
        throw error;
      }

      return {
        totalProcessed: count || 0,
      };
    } catch (error) {
      logger.error('Error getting processing stats:', error);
      return { totalProcessed: 0 };
    }
  }

  /**
   * Delete old processed records (optional cleanup)
   * @param {number} daysOld - Delete records older than this many days
   */
  async cleanupOldRecords(daysOld = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const { data, error } = await this.supabase
        .from(this.tableName)
        .delete()
        .lt('processed_at', cutoffDate.toISOString());

      if (error) {
        throw error;
      }

      logger.info(`Cleaned up records older than ${daysOld} days`);
      return data;
    } catch (error) {
      logger.error('Error cleaning up old records:', error);
      throw error;
    }
  }
}

export default SupabaseService;



