import { config, validateConfig } from './config/credentials.js';
import logger from './utils/logger.js';
import GmailService from './services/gmail.service.js';
import PDFService from './services/pdf.service.js';
import SheetsService from './services/sheets.service.js';
import SupabaseService from './services/supabase.service.js';
import LicitacionesService from './services/licitaciones.service.js';
import DriveService from './services/drive.service.js';
import SchedulerService from './services/scheduler.service.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

class LicitacionAgent {
  constructor() {
    this.gmailService = new GmailService();
    this.pdfService = new PDFService();
    this.sheetsService = new SheetsService();
    this.supabaseService = new SupabaseService();
    this.licitacionesService = new LicitacionesService();
    this.driveService = new DriveService();
    this.scheduler = null;
  }

  /**
   * Check if bidding is still open based on close date
   * @param {string} closeDateStr - Close date string (e.g., "3 de noviembre", "November 3, 2025")
   * @returns {boolean} True if bidding is still open
   */
  isBiddingOpen(closeDateStr) {
    if (!closeDateStr || closeDateStr === 'No disponible') {
      // If no close date, assume it's open to be safe
      return true;
    }

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to start of day for comparison

      // Dates are now standardized to MM/DD/YYYY format
      const usDateMatch = closeDateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (usDateMatch) {
        const month = parseInt(usDateMatch[1]) - 1; // JavaScript months are 0-indexed
        const day = parseInt(usDateMatch[2]);
        const year = parseInt(usDateMatch[3]);
        
        const closeDate = new Date(year, month, day);
        closeDate.setHours(23, 59, 59, 999); // Set to end of day
        
        // Return true if close date is today or in the future
        return closeDate >= today;
      }

      // If we can't parse the date, include it to be safe
      logger.warn(`Could not parse close date: ${closeDateStr}, including in results`);
      return true;

    } catch (error) {
      logger.error(`Error parsing close date: ${closeDateStr}`, error);
      // Include if error parsing
      return true;
    }
  }

  /**
   * Initialize the agent
   */
  async initialize() {
    try {
      logger.info('Initializing Licitación Agent...');

      // Validate configuration
      validateConfig();
      logger.info('Configuration validated successfully');

      // Ensure logs directory exists
      if (!fs.existsSync('logs')) {
        fs.mkdirSync('logs');
      }

      // Initialize services
      await this.supabaseService.ensureTableExists();
      await this.licitacionesService.ensureTableExists();
      await this.driveService.ensureLicitacionesFolder();

      logger.info('Licitación Agent initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize agent:', error);
      throw error;
    }
  }

  /**
   * Main processing function - scans Gmail and processes new Licitación emails
   */
  async processLicitacionEmails() {
    try {
      logger.info('=== Starting Licitación Email Processing ===');

      // Use EMAIL_SEARCH_START_DATE env var, or default to 90 days ago
      const afterDate = (() => {
        const envDate = process.env.EMAIL_SEARCH_START_DATE;
        if (envDate) {
          const parsed = new Date(envDate);
          if (!isNaN(parsed.getTime())) return parsed;
          logger.warn(`Invalid EMAIL_SEARCH_START_DATE "${envDate}", using 90-day default`);
        }
        const d = new Date();
        d.setDate(d.getDate() - 90);
        d.setHours(0, 0, 0, 0);
        return d;
      })();
      const messages = await this.gmailService.searchLicitacionEmails(afterDate);

      if (messages.length === 0) {
        logger.info('No new Licitación emails found');
        return;
      }

      logger.info(`Found ${messages.length} potential emails to process`);

      let processedCount = 0;
      let skippedAlreadyProcessed = 0;
      let skippedBiddingClosed = 0;
      let errorCount = 0;

      // Process each email
      for (const message of messages) {
        try {
          // Check if already processed
          const isProcessed = await this.supabaseService.isEmailProcessed(message.id);
          
          if (isProcessed) {
            logger.info(`Skipping already processed email: ${message.id}`);
            skippedAlreadyProcessed++;
            continue;
          }

          // Get email details
          const emailDetails = await this.gmailService.getEmailDetails(message.id);

          // Process each PDF attachment
          let emailHadError = false;
          for (const attachment of emailDetails.attachments) {
            try {
              logger.info(`Processing attachment: ${attachment.filename}`);

              // Extract PDF content
              const pdfData = await this.pdfService.processPDFAttachment(attachment);

              // Upload PDF to Google Drive
              const pdfBuffer = Buffer.from(attachment.data, 'base64');
              const driveLink = await this.driveService.uploadPDF(pdfBuffer, attachment.filename);

              // Upload PDF to Supabase Storage
              const supabaseUpload = await this.supabaseService.uploadPdfToStorage(
                pdfBuffer,
                attachment.filename,
                emailDetails.id
              );
              const supabaseLink = supabaseUpload?.publicUrl;

              // Create hyperlink formula for Google Sheets
              const pdfHref = supabaseLink || driveLink;
              const pdfLinkFormula = pdfHref
                ? this.driveService.createHyperlinkFormula(pdfHref, '📄 Ver PDF')
                : 'N/A';
              const resolvedPdfLink = pdfHref || ''; // fallback only if undefined

              // Prepare data for Google Sheets
              const sheetData = {
                emailId: emailDetails.id,
                emailDate: emailDetails.date,
                subject: emailDetails.subject,
                location: pdfData.location,
                description: pdfData.description,
                summary: pdfData.summary,
                category: pdfData.category || 'No clasificado',
                priority: pdfData.priority || 'Medium',
                pdfFilename: pdfData.filename,
                pdfLink: pdfLinkFormula,
                siteVisitDate: pdfData.siteVisitDate,
                siteVisitTime: pdfData.siteVisitTime,
                visitLocation: pdfData.visitLocation,
                contactName: pdfData.contactName,
                contactPhone: pdfData.contactPhone,
                biddingCloseDate: pdfData.biddingCloseDate,
                biddingCloseTime: pdfData.biddingCloseTime,
                extractionMethod: pdfData.extractionMethod || 'Regex',
              };

              // Filter out minuta or asistencia entries based on PDF filename
              const pdfFilenameLower = (pdfData.filename || '').toLowerCase();
              const isMinutaOrAsistencia = pdfFilenameLower.includes('minuta') ||
                                           pdfFilenameLower.includes('asistencia');

              if (isMinutaOrAsistencia) {
                logger.info(`⏭️  Skipped (minuta/asistencia in filename): ${pdfData.filename}`);
                skippedBiddingClosed++; // Reuse this counter for consistency
                continue;
              }

              // Check if bidding is still open (close date hasn't passed)
              const isOpen = this.isBiddingOpen(pdfData.biddingCloseDate);

              if (isOpen) {
                // Only append to Google Sheets if bidding is still open
                await this.sheetsService.appendLicitacionData(sheetData);
                logger.info(`✅ Added to sheet (bidding open until: ${pdfData.biddingCloseDate})`);
                processedCount++;
              } else {
                logger.info(`⏭️  Skipped from sheet (bidding closed on: ${pdfData.biddingCloseDate})`);
                skippedBiddingClosed++;
              }

              // Save to licitaciones table for dashboard
              await this.licitacionesService.saveLicitacion({
                ...sheetData,
                pdfUrl: resolvedPdfLink,
              });

              // Mark as processed in Supabase (regardless of open/closed status)
              await this.supabaseService.markEmailAsProcessed({
                emailId: emailDetails.id,
                subject: emailDetails.subject,
                location: pdfData.location,
                description: pdfData.description,
                pdfFilename: pdfData.filename,
              });

              logger.info(`Successfully processed: ${attachment.filename}`);

            } catch (pdfError) {
              logger.error(`Error processing PDF ${attachment.filename}:`, pdfError);
              emailHadError = true;
              errorCount++;
            }
          }

          // Only mark email as read if all attachments processed successfully
          if (!emailHadError) {
            await this.gmailService.markAsRead(message.id);
          } else {
            logger.warn(`Skipping markAsRead for ${message.id} due to processing errors`);
          }

        } catch (emailError) {
          logger.error(`Error processing email ${message.id}:`, emailError);
          errorCount++;
        }
      }

      // Log summary
      logger.info('=== Processing Summary ===');
      logger.info(`Total emails found: ${messages.length}`);
      logger.info(`✅ Added to Google Sheets (open biddings): ${processedCount}`);
      logger.info(`⏭️  Skipped (bidding closed): ${skippedBiddingClosed}`);
      logger.info(`⏭️  Skipped (already processed): ${skippedAlreadyProcessed}`);
      logger.info(`❌ Errors: ${errorCount}`);
      logger.info('=== Processing Complete ===');

      // Get stats
      const stats = await this.supabaseService.getProcessingStats();
      logger.info(`Total emails processed to date: ${stats.totalProcessed}`);

    } catch (error) {
      logger.error('Error in main processing function:', error);
      throw error;
    }
  }

  /**
   * Start the scheduler
   */
  startScheduler() {
    this.scheduler = new SchedulerService(async () => {
      await this.processLicitacionEmails();
    });

    this.scheduler.start();
  }

  /**
   * Stop the scheduler
   */
  stopScheduler() {
    if (this.scheduler) {
      this.scheduler.stop();
    }
  }

  /**
   * Run once without scheduling
   */
  async runOnce() {
    await this.initialize();
    await this.processLicitacionEmails();
  }
}

// Main execution
async function main() {
  try {
    const agent = new LicitacionAgent();
    await agent.initialize();

    // Start the scheduler
    agent.startScheduler();

    logger.info('Licitación Agent is running...');
    logger.info('Press Ctrl+C to stop');

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      agent.stopScheduler();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      agent.stopScheduler();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Fatal error:', error);
    process.exit(1);
  }
}

// Only run the scheduler when executed directly (not when imported by Vercel cron)
const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMainModule) {
  main();
}

export { LicitacionAgent };

