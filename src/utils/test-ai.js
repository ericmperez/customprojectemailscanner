import { LicitacionAgent } from '../index.js';

async function testAI() {
  try {
    console.log('🧪 Testing AI Extraction with 3 most recent emails\n');

    const agent = new LicitacionAgent();
    await agent.initialize();

    // Get emails
    const afterDate = new Date('2025-10-01T00:00:00');
    const messages = await agent.gmailService.searchLicitacionEmails(afterDate);

    if (messages.length === 0) {
      console.log('❌ No emails found');
      return;
    }

    console.log(`Found ${messages.length} emails, testing with last 3...\n`);

    // Take only the last 3 emails
    const testMessages = messages.slice(-3);

    let processedCount = 0;
    let errorCount = 0;

    for (const message of testMessages) {
      try {
        console.log(`\n${'='.repeat(60)}`);
        
        // Get email details
        const emailDetails = await agent.gmailService.getEmailDetails(message.id);
        console.log(`📧 Email: ${emailDetails.subject}`);
        console.log(`📅 Date: ${emailDetails.date}`);
        console.log(`From: ${emailDetails.from}\n`);

        // Process each PDF attachment
        for (const attachment of emailDetails.attachments) {
          try {
            console.log(`📄 Processing: ${attachment.filename}`);

            // Extract PDF content
            const pdfData = await agent.pdfService.processPDFAttachment(attachment);

            // Display results
            console.log('\n✅ EXTRACTION RESULTS:');
            console.log('─'.repeat(60));
            console.log(`Method:          ${pdfData.extractionMethod || 'Regex'}`);
            if (pdfData.confidence) {
              console.log(`Confidence:      ${pdfData.confidence}%`);
            }
            if (pdfData.category) {
              console.log(`Categoría:       ${pdfData.category}`);
            }
            if (pdfData.priority) {
              console.log(`Prioridad:       ${pdfData.priority}`);
            }
            console.log(`Ubicación:       ${pdfData.location}`);
            console.log(`Resumen:         ${pdfData.summary}`);
            console.log(`Site Visit:      ${pdfData.siteVisitDate} @ ${pdfData.siteVisitTime}`);
            console.log(`Lugar Visita:    ${pdfData.visitLocation}`);
            console.log(`Contacto:        ${pdfData.contactName}`);
            console.log(`Teléfono:        ${pdfData.contactPhone}`);
            console.log(`Cierre:          ${pdfData.biddingCloseDate} @ ${pdfData.biddingCloseTime}`);
            console.log('─'.repeat(60));

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
              console.log(`\n✅ Added to Google Sheets (bidding open)`);
              processedCount++;
            } else {
              console.log(`\n⏭️  Skipped (bidding closed on: ${pdfData.biddingCloseDate})`);
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
            console.error(`❌ Error processing PDF ${attachment.filename}:`, pdfError.message);
            errorCount++;
          }
        }

      } catch (emailError) {
        console.error(`❌ Error processing email ${message.id}:`, emailError.message);
        errorCount++;
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('🎉 TEST COMPLETE');
    console.log(`✅ Successfully processed: ${processedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`${'='.repeat(60)}\n`);

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testAI();

