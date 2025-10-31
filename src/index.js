import { config, validateConfig } from './config/credentials.js';
import logger from './utils/logger.js';
import GmailService from './services/gmail.service.js';
import PDFService from './services/pdf.service.js';
import SheetsService from './services/sheets.service.js';
import SupabaseService from './services/supabase.service.js';
import DriveService from './services/drive.service.js';
import SchedulerService from './services/scheduler.service.js';
import fs from 'fs';
import path from 'path';

class LicitacionAgent {
  constructor() {
    this.gmailService = new GmailService();
    this.pdfService = new PDFService();
    this.sheetsService = new SheetsService();
    this.supabaseService = new SupabaseService();
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

      // Try to parse MM/DD/YYYY format (e.g., "11/29/2025")
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

      // Parse Spanish month names
      const spanishMonths = {
        'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3,
        'mayo': 4, 'junio': 5, 'julio': 6, 'agosto': 7,
        'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
      };

      // Try to parse date in format "3 de noviembre" or "3 de noviembre de 2025"
      const spanishDateMatch = closeDateStr.match(/(\d{1,2})\s+de\s+(\w+)(?:\s+de\s+(\d{4}))?/i);
      
      if (spanishDateMatch) {
        const day = parseInt(spanishDateMatch[1]);
        const monthName = spanishDateMatch[2].toLowerCase();
        const year = spanishDateMatch[3] ? parseInt(spanishDateMatch[3]) : today.getFullYear();
        
        const monthNum = spanishMonths[monthName];
        
        if (monthNum !== undefined) {
          const closeDate = new Date(year, monthNum, day);
          closeDate.setHours(23, 59, 59, 999); // Set to end of day
          
          // Return true if close date is today or in the future
          return closeDate >= today;
        }
      }

      // Try standard date parsing as fallback
      const parsedDate = new Date(closeDateStr);
      if (!isNaN(parsedDate.getTime())) {
        parsedDate.setHours(23, 59, 59, 999);
        return parsedDate >= today;
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
      await this.sheetsService.initializeSheet();
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

      // Search for Licitación emails from October 1st, 2025 onwards
      const afterDate = new Date('2025-10-01T00:00:00');
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
          for (const attachment of emailDetails.attachments) {
            try {
              logger.info(`Processing attachment: ${attachment.filename}`);

              // Extract PDF content
              const pdfData = await this.pdfService.processPDFAttachment(attachment);

              // Upload PDF to Google Drive
              const pdfBuffer = Buffer.from(attachment.data, 'base64');
              const driveLink = await this.driveService.uploadPDF(pdfBuffer, attachment.filename);
              
              // Create hyperlink formula for Google Sheets
              const pdfLinkFormula = driveLink 
                ? this.driveService.createHyperlinkFormula(driveLink, '📄 Ver PDF')
                : 'N/A';

              // Prepare data for Google Sheets
              const sheetData = {
                emailId: emailDetails.id,
                emailDate: emailDetails.date,
                subject: emailDetails.subject,
                location: pdfData.location,
                description: pdfData.description,
                summary: pdfData.summary,
                pdfFilename: pdfData.filename,
                pdfLink: pdfLinkFormula,
                siteVisitDate: pdfData.siteVisitDate,
                siteVisitTime: pdfData.siteVisitTime,
                contactName: pdfData.contactName,
                contactPhone: pdfData.contactPhone,
                biddingCloseDate: pdfData.biddingCloseDate,
                biddingCloseTime: pdfData.biddingCloseTime,
              };

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
              errorCount++;
            }
          }

          // Optional: Mark email as read
          await this.gmailService.markAsRead(message.id);

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

// Run the agent
main();

export { LicitacionAgent };

