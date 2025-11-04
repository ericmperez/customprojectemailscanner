import { LicitacionAgent } from '../index.js';

async function processLast7Days() {
  try {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    
    console.log(`📅 Processing emails from last 7 days`);
    console.log(`   From: ${sevenDaysAgo.toLocaleDateString()}`);
    console.log(`   To: ${today.toLocaleDateString()}\n`);

    const agent = new LicitacionAgent();
    await agent.initialize();

    // Get emails from 7 days ago
    const messages = await agent.gmailService.searchLicitacionEmails(sevenDaysAgo);

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
        const emailDetails = await agent.gmailService.getEmailDetails(message.id);
        const emailDate = new Date(emailDetails.date);

        console.log(`\n[${currentEmail}/${messages.length}] 📧 ${emailDetails.subject}`);
        console.log(`   📅 ${emailDate.toLocaleDateString()} ${emailDate.toLocaleTimeString()}`);

        // Process each PDF attachment
        for (const attachment of emailDetails.attachments) {
          try {
            console.log(`   📄 ${attachment.filename}...`);

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

            // Check if bidding is still open
            const isOpen = agent.isBiddingOpen(pdfData.biddingCloseDate);

            if (isOpen) {
              await agent.sheetsService.appendLicitacionData(sheetData);
              console.log(`   ✅ Added | ${pdfData.category} | ${pdfData.extractionMethod} (${pdfData.confidence}%)`);
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

processLast7Days();

