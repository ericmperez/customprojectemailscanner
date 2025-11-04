import { google } from 'googleapis';
import { config } from '../config/credentials.js';
import GmailService from '../services/gmail.service.js';
import PDFService from '../services/pdf.service.js';
import SheetsService from '../services/sheets.service.js';
import DriveService from '../services/drive.service.js';
import SupabaseService from '../services/supabase.service.js';
import logger from '../utils/logger.js';

// This script uses services directly without starting the scheduler (no duplicates!)

async function processLast7Days() {
  try {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    
    console.log(`📅 Processing emails from last 7 days`);
    console.log(`   From: ${sevenDaysAgo.toLocaleDateString()}`);
    console.log(`   To: ${today.toLocaleDateString()}\n`);

    // Initialize services directly (no scheduler)
    const gmailService = new GmailService();
    const pdfService = new PDFService();
    const sheetsService = new SheetsService();
    const driveService = new DriveService();
    const supabaseService = new SupabaseService();

    // Ensure Drive folder exists
    await driveService.ensureLicitacionesFolder();
    
    // Ensure Supabase table exists
    await supabaseService.ensureTableExists();

    console.log('✅ Services initialized\n');

    // Get emails from 7 days ago
    const messages = await gmailService.searchLicitacionEmails(sevenDaysAgo);

    if (messages.length === 0) {
      console.log('❌ No emails found');
      return;
    }

    console.log(`📊 Found ${messages.length} emails in the last 7 days\n`);

    let processedCount = 0;
    let skippedBiddingClosed = 0;
    let errorCount = 0;
    let currentEmail = 0;

    for (const message of messages) {
      try {
        currentEmail++;
        
        // Get email details
        const emailDetails = await gmailService.getEmailDetails(message.id);
        const emailDate = new Date(emailDetails.date);

        console.log(`\n[${currentEmail}/${messages.length}] 📧 ${emailDetails.subject}`);
        console.log(`   📅 ${emailDate.toLocaleDateString()} ${emailDate.toLocaleTimeString()}`);

        // Process each PDF attachment
        for (const attachment of emailDetails.attachments) {
          try {
            console.log(`   📄 ${attachment.filename}...`);

            // Extract PDF content with AI
            const pdfData = await pdfService.processPDFAttachment(attachment);

            // Upload PDF to Drive
            const pdfBuffer = Buffer.from(attachment.data, 'base64');
            const driveLink = await driveService.uploadPDF(pdfBuffer, attachment.filename);
            const pdfLinkFormula = driveLink 
              ? driveService.createHyperlinkFormula(driveLink, '📄 Ver PDF')
              : 'N/A';

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

            // Check if bidding is still open
            const isOpen = isBiddingOpen(pdfData.biddingCloseDate);

            if (isOpen) {
              await sheetsService.appendLicitacionData(sheetData);
              console.log(`   ✅ Added | ${pdfData.category} | ${pdfData.extractionMethod} (${pdfData.confidence}%)`);
              processedCount++;
            } else {
              console.log(`   ⏭️  Skipped (closed: ${pdfData.biddingCloseDate})`);
              skippedBiddingClosed++;
            }

            // Mark as processed in Supabase
            await supabaseService.markEmailAsProcessed({
              emailId: emailDetails.id,
              subject: emailDetails.subject,
              location: pdfData.location,
              description: pdfData.description,
              pdfFilename: pdfData.filename,
            });

          } catch (pdfError) {
            console.error(`   ❌ Error: ${pdfError.message}`);
            errorCount++;
          }
        }

        // Mark email as read
        await gmailService.markAsRead(message.id);

      } catch (emailError) {
        console.error(`❌ Error processing email: ${emailError.message}`);
        errorCount++;
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('🎉 PROCESSING COMPLETE');
    console.log(`📅 Period: ${sevenDaysAgo.toLocaleDateString()} - ${today.toLocaleDateString()}`);
    console.log(`✅ Added to Google Sheets: ${processedCount}`);
    console.log(`⏭️  Skipped (closed): ${skippedBiddingClosed}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total processed: ${currentEmail} emails`);
    console.log(`${'='.repeat(60)}\n`);

    process.exit(0);

  } catch (error) {
    console.error('❌ Processing failed:', error);
    process.exit(1);
  }
}

// Check if bidding is still open
function isBiddingOpen(closeDateStr) {
  if (!closeDateStr || closeDateStr === 'No disponible') {
    return true;
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const usDateMatch = closeDateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (usDateMatch) {
      const month = parseInt(usDateMatch[1]) - 1;
      const day = parseInt(usDateMatch[2]);
      const year = parseInt(usDateMatch[3]);
      
      const closeDate = new Date(year, month, day);
      closeDate.setHours(23, 59, 59, 999);
      
      return closeDate >= today;
    }

    logger.warn(`Could not parse close date: ${closeDateStr}, including in results`);
    return true;

  } catch (error) {
    logger.error(`Error parsing close date: ${closeDateStr}`, error);
    return true;
  }
}

processLast7Days();

