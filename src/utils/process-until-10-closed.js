import GmailService from '../services/gmail.service.js';
import PDFService from '../services/pdf.service.js';
import SheetsService from '../services/sheets.service.js';
import DriveService from '../services/drive.service.js';
import SupabaseService from '../services/supabase.service.js';
import logger from '../utils/logger.js';

// Smart processing: Stop when 10 consecutive closed biddings are found

async function processUntilTenClosed() {
  try {
    console.log('🔍 Smart Email Processing');
    console.log('   Strategy: Process until 10 consecutive closed biddings found');
    console.log('   Only open biddings will be added to Google Sheets\n');

    // Initialize services
    const gmailService = new GmailService();
    const pdfService = new PDFService();
    const sheetsService = new SheetsService();
    const driveService = new DriveService();
    const supabaseService = new SupabaseService();

    await driveService.ensureLicitacionesFolder();
    await supabaseService.ensureTableExists();

    console.log('✅ Services initialized\n');

    // Get all emails from October 1st onwards
    const afterDate = new Date('2025-10-01T00:00:00');
    const messages = await gmailService.searchLicitacionEmails(afterDate);

    if (messages.length === 0) {
      console.log('❌ No emails found');
      return;
    }

    console.log(`📊 Found ${messages.length} total emails to scan\n`);

    let processedCount = 0;
    let skippedAlreadyProcessed = 0;
    let consecutiveClosedCount = 0;
    let errorCount = 0;
    let currentEmail = 0;
    let totalScanned = 0;

    // Process emails (newest to oldest)
    for (const message of messages) {
      // Stop if we found 10 consecutive closed biddings
      if (consecutiveClosedCount >= 10) {
        console.log(`\n🛑 Stopping: Found ${consecutiveClosedCount} consecutive closed biddings`);
        console.log('   All older emails likely have closed biddings\n');
        break;
      }

      try {
        currentEmail++;
        totalScanned++;
        
        // Check if already processed
        const isProcessed = await supabaseService.isEmailProcessed(message.id);
        if (isProcessed) {
          skippedAlreadyProcessed++;
          continue;
        }

        // Get email details
        const emailDetails = await gmailService.getEmailDetails(message.id);
        const emailDate = new Date(emailDetails.date);

        console.log(`\n[${currentEmail}] 📧 ${emailDetails.subject}`);
        console.log(`   📅 ${emailDate.toLocaleDateString()} | Consecutive closed: ${consecutiveClosedCount}/10`);

        let emailHasOpenBidding = false;

        // Process each PDF attachment
        for (const attachment of emailDetails.attachments) {
          try {
            console.log(`   📄 ${attachment.filename}...`);

            // Extract PDF content with AI
            const pdfData = await pdfService.processPDFAttachment(attachment);

            // Check if bidding is still open
            const isOpen = isBiddingOpen(pdfData.biddingCloseDate);

            if (isOpen) {
              // Reset consecutive closed counter (found an open bidding!)
              consecutiveClosedCount = 0;
              emailHasOpenBidding = true;

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

              await sheetsService.appendLicitacionData(sheetData);
              console.log(`   ✅ Added | ${pdfData.category} | Close: ${pdfData.biddingCloseDate} | ${pdfData.extractionMethod} (${pdfData.confidence}%)`);
              processedCount++;
            } else {
              console.log(`   ⏭️  Closed: ${pdfData.biddingCloseDate} (not added to sheet)`);
            }

            // Mark as processed in Supabase (regardless of open/closed)
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

        // Increment consecutive closed counter if this email had no open biddings
        if (!emailHasOpenBidding) {
          consecutiveClosedCount++;
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
    console.log(`📊 Total emails scanned: ${totalScanned}`);
    console.log(`✅ Added to Google Sheets (open biddings): ${processedCount}`);
    console.log(`⏭️  Skipped (already processed): ${skippedAlreadyProcessed}`);
    console.log(`🛑 Stopped after: ${consecutiveClosedCount} consecutive closed biddings`);
    console.log(`❌ Errors: ${errorCount}`);
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

processUntilTenClosed();

