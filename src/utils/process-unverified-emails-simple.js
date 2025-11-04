import GmailService from '../services/gmail.service.js';
import PDFService from '../services/pdf.service.js';
import SheetsService from '../services/sheets.service.js';
import DriveService from '../services/drive.service.js';
import SupabaseService from '../services/supabase.service.js';
import logger from '../utils/logger.js';

/**
 * Process emails that are not yet verified and still have open bidding dates
 * This version works without the licitaciones table and focuses on
 * re-processing emails that might have been skipped due to closed dates
 * but are actually still open
 */

// Check if bidding is still open
function isBiddingOpen(closeDateStr) {
  if (!closeDateStr) return true;

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today

    // Parse different date formats
    const spanishMonths = {
      'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
      'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
    };

    const englishMonths = {
      'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5, 'june': 6,
      'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12
    };

    // Try US format (MM/DD/YYYY or MM-DD-YYYY)
    const usDateMatch = closeDateStr.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
    if (usDateMatch) {
      const month = parseInt(usDateMatch[1]) - 1; // JavaScript months are 0-indexed
      const day = parseInt(usDateMatch[2]);
      const year = parseInt(usDateMatch[3]);
      
      const closeDate = new Date(year, month, day);
      closeDate.setHours(23, 59, 59, 999); // Set to end of day
      
      return closeDate >= today;
    }

    // If we can't parse the date, include it to be safe
    logger.warn(`Could not parse close date: ${closeDateStr}, including in results`);
    return true;

  } catch (error) {
    logger.error(`Error parsing close date: ${closeDateStr}`, error);
    return true;
  }
}

async function processUnverifiedEmails() {
  try {
    console.log('🔍 Processing Unverified Emails with Open Biddings');
    console.log('   Strategy: Re-process recent emails and check bidding dates');
    console.log('   Focus: Emails from last 30 days that may have open biddings\n');

    // Initialize services directly
    const gmailService = new GmailService();
    const pdfService = new PDFService();
    const sheetsService = new SheetsService();
    const driveService = new DriveService();
    const supabaseService = new SupabaseService();

    // Ensure services are ready
    await driveService.ensureLicitacionesFolder();
    await supabaseService.ensureTableExists();

    console.log('✅ Services initialized\n');

    // Get emails from last 30 days (more likely to have open biddings)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    console.log(`📅 Searching emails from: ${thirtyDaysAgo.toLocaleDateString()}`);
    
    const messages = await gmailService.searchLicitacionEmails(thirtyDaysAgo);

    if (messages.length === 0) {
      console.log('❌ No emails found in the last 30 days');
      return;
    }

    console.log(`📊 Found ${messages.length} emails in the last 30 days\n`);

    let processedCount = 0;
    let skippedBiddingClosed = 0;
    let skippedAlreadyProcessed = 0;
    let errorCount = 0;
    let currentEmail = 0;

    for (const message of messages) {
      try {
        currentEmail++;
        
        console.log(`\n[${currentEmail}/${messages.length}] 📧 Processing email...`);

        // Check if already processed
        const isProcessed = await supabaseService.isEmailProcessed(message.id);
        
        if (isProcessed) {
          console.log(`   ⏭️  Already processed: ${message.id}`);
          skippedAlreadyProcessed++;
          continue;
        }

        // Get email details
        const emailDetails = await gmailService.getEmailDetails(message.id);
        const emailDate = new Date(emailDetails.date);

        console.log(`   📧 ${emailDetails.subject}`);
        console.log(`   📅 ${emailDate.toLocaleDateString()}`);

        // Process each PDF attachment
        for (const attachment of emailDetails.attachments) {
          try {
            console.log(`   📄 ${attachment.filename}...`);

            // Extract PDF content
            const pdfData = await pdfService.processPDFAttachment(attachment);

            console.log(`   🏢 Location: ${pdfData.location}`);
            console.log(`   📝 Description: ${pdfData.description.substring(0, 100)}...`);
            console.log(`   🗓️  Close Date: ${pdfData.biddingCloseDate}`);

            // Check if bidding is still open
            const isOpen = isBiddingOpen(pdfData.biddingCloseDate);

            if (!isOpen) {
              console.log(`   ⏭️  Skipped (bidding closed: ${pdfData.biddingCloseDate})`);
              skippedBiddingClosed++;
            } else {
              console.log(`   ✅ Bidding is OPEN - adding to Google Sheets...`);

              // Upload PDF to Drive
              const pdfBuffer = Buffer.from(attachment.data, 'base64');
              const driveLink = await driveService.uploadPDF(pdfBuffer, attachment.filename);
              
              // Create hyperlink formula
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

              // Filter out minuta or asistencia entries based on PDF filename
              const pdfFilenameLower = (pdfData.filename || '').toLowerCase();
              const isMinutaOrAsistencia = pdfFilenameLower.includes('minuta') || 
                                           pdfFilenameLower.includes('asistencia');

              if (isMinutaOrAsistencia) {
                console.log(`   ⏭️  Skipped (minuta/asistencia in filename): ${pdfData.filename}`);
                continue;
              }

              // Add to Google Sheets
              await sheetsService.appendLicitacionData(sheetData);
              console.log(`   ✅ Added to Google Sheets | ${pdfData.category} | Close: ${pdfData.biddingCloseDate}`);
              processedCount++;
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
            console.error(`   ❌ Error processing PDF: ${pdfError.message}`);
            errorCount++;
          }
        }

        // Mark email as read
        await gmailService.markAsRead(message.id);

      } catch (emailError) {
        console.error(`   ❌ Error processing email: ${emailError.message}`);
        errorCount++;
      }
    }

    // Final summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 PROCESSING SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total emails checked: ${messages.length}`);
    console.log(`✅ Added to Google Sheets (open biddings): ${processedCount}`);
    console.log(`⏭️  Skipped (bidding closed): ${skippedBiddingClosed}`);
    console.log(`⏭️  Skipped (already processed): ${skippedAlreadyProcessed}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('='.repeat(50));

    if (processedCount > 0) {
      console.log(`\n🎉 SUCCESS! ${processedCount} emails with open biddings have been added to Google Sheets.`);
      console.log('💡 These are now available for review and bidding.');
    } else if (skippedAlreadyProcessed > 0) {
      console.log('\n📝 All recent emails have already been processed.');
    } else {
      console.log('\n📝 No emails with open biddings found in the last 30 days.');
    }

  } catch (error) {
    logger.error('Error in processUnverifiedEmails:', error);
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the script
processUnverifiedEmails();