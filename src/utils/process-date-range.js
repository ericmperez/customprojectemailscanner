import { LicitacionAgent } from '../index.js';
import logger from '../utils/logger.js';

async function processDateRange() {
  try {
    console.log('📅 Processing emails from October 1-20, 2025\n');

    const agent = new LicitacionAgent();
    await agent.initialize();

    // Get emails from October 1st onwards
    const afterDate = new Date('2025-10-01T00:00:00');
    const messages = await agent.gmailService.searchLicitacionEmails(afterDate);

    if (messages.length === 0) {
      console.log('❌ No emails found');
      return;
    }

    console.log(`Found ${messages.length} emails total\n`);

    // Filter emails until October 20, 2025
    const untilDate = new Date('2025-10-20T23:59:59');
    
    let filteredMessages = [];
    for (const message of messages) {
      const emailDetails = await agent.gmailService.getEmailDetails(message.id);
      const emailDate = new Date(emailDetails.date);
      
      if (emailDate <= untilDate) {
        filteredMessages.push(message);
      }
    }

    console.log(`📊 Filtered to ${filteredMessages.length} emails (Oct 1-20)\n`);

    let processedCount = 0;
    let skippedBiddingClosed = 0;
    let errorCount = 0;

    for (const message of filteredMessages) {
      try {
        // Get email details
        const emailDetails = await agent.gmailService.getEmailDetails(message.id);
        const emailDate = new Date(emailDetails.date);

        console.log(`\n📧 Processing: ${emailDetails.subject} (${emailDate.toLocaleDateString()})`);

        // Process each PDF attachment
        for (const attachment of emailDetails.attachments) {
          try {
            console.log(`   📄 ${attachment.filename}`);

            // Extract PDF content with AI
            const pdfData = await agent.pdfService.processPDFAttachment(attachment);

            // Upload PDF to Drive
            const pdfBuffer = Buffer.from(attachment.data, 'base64');
            const driveLink = await agent.driveService.uploadPDF(pdfBuffer, attachment.filename);
            const pdfLinkFormula = driveLink 
              ? agent.driveService.createHyperlinkFormula(driveLink, '📄 Ver PDF')
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
              skippedBiddingClosed++; // Reuse this counter
              continue;
            }

            // Check if bidding is still open
            const isOpen = agent.isBiddingOpen(pdfData.biddingCloseDate);

            if (isOpen) {
              await agent.sheetsService.appendLicitacionData(sheetData);
              console.log(`   ✅ Added (${pdfData.extractionMethod}, ${pdfData.confidence}% confidence)`);
              processedCount++;
            } else {
              console.log(`   ⏭️  Skipped (closed: ${pdfData.biddingCloseDate})`);
              skippedBiddingClosed++;
            }

            // Mark as processed in Supabase
            await agent.supabaseService.markEmailAsProcessed({
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
        await agent.gmailService.markAsRead(message.id);

      } catch (emailError) {
        console.error(`❌ Error processing email: ${emailError.message}`);
        errorCount++;
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('🎉 PROCESSING COMPLETE');
    console.log(`✅ Added to Google Sheets: ${processedCount}`);
    console.log(`⏭️  Skipped (closed): ${skippedBiddingClosed}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`${'='.repeat(60)}\n`);

    process.exit(0);

  } catch (error) {
    console.error('❌ Processing failed:', error);
    process.exit(1);
  }
}

processDateRange();

