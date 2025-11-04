import { LicitacionAgent } from '../index.js';
import SupabaseService from '../services/supabase.service.js';
import LicitacionesService from '../services/licitaciones.service.js';
import logger from '../utils/logger.js';

/**
 * Process emails for unverified licitaciones that still have open biddings
 * This script will:
 * 1. Get all unverified (pending) licitaciones from the database
 * 2. Check which ones still have open bidding dates
 * 3. Re-process those emails to update Google Sheets
 */
async function processUnverifiedOpenBiddings() {
  try {
    console.log('🔍 Processing Unverified Licitaciones with Open Biddings');
    console.log('   Strategy: Find pending approvals with open bidding dates');
    console.log('   Action: Re-process and add to Google Sheets\n');

    // Initialize services
    const agent = new LicitacionAgent();
    await agent.initialize();
    
    const licitacionesService = new LicitacionesService();
    
    console.log('✅ Services initialized\n');

    // Get all pending (unverified) licitaciones
    const pendingLicitaciones = await licitacionesService.getAllLicitaciones({
      status: 'pending'
    });

    if (pendingLicitaciones.length === 0) {
      console.log('❌ No pending (unverified) licitaciones found');
      return;
    }

    console.log(`📊 Found ${pendingLicitaciones.length} pending licitaciones\n`);

    let processedCount = 0;
    let skippedBiddingClosed = 0;
    let skippedAlreadyInSheets = 0;
    let errorCount = 0;
    let currentLicitacion = 0;

    for (const licitacion of pendingLicitaciones) {
      try {
        currentLicitacion++;
        
        console.log(`\n[${currentLicitacion}/${pendingLicitaciones.length}] 📧 ${licitacion.subject}`);
        console.log(`   📅 Email Date: ${new Date(licitacion.email_date).toLocaleDateString()}`);
        console.log(`   🏢 Location: ${licitacion.location}`);
        console.log(`   📄 PDF: ${licitacion.pdf_filename}`);
        console.log(`   🗓️  Close Date: ${licitacion.bidding_close_date}`);

        // Check if bidding is still open
        const isOpen = agent.isBiddingOpen(licitacion.bidding_close_date);

        if (!isOpen) {
          console.log(`   ⏭️  Skipped (bidding closed: ${licitacion.bidding_close_date})`);
          skippedBiddingClosed++;
          continue;
        }

        console.log(`   ✅ Bidding is OPEN - processing...`);

        // Prepare data for Google Sheets (same format as main agent)
        const sheetData = {
          emailId: licitacion.email_id,
          emailDate: licitacion.email_date,
          subject: licitacion.subject,
          location: licitacion.location,
          description: licitacion.description,
          summary: licitacion.summary,
          category: licitacion.category || 'No clasificado',
          priority: licitacion.priority || 'Medium',
          pdfFilename: licitacion.pdf_filename,
          pdfLink: licitacion.pdf_link,
          siteVisitDate: licitacion.site_visit_date,
          siteVisitTime: licitacion.site_visit_time,
          visitLocation: licitacion.visit_location,
          contactName: licitacion.contact_name,
          contactPhone: licitacion.contact_phone,
          biddingCloseDate: licitacion.bidding_close_date,
          biddingCloseTime: licitacion.bidding_close_time,
          extractionMethod: licitacion.extraction_method || 'Regex',
        };

        // Add to Google Sheets
        await agent.sheetsService.appendLicitacionData(sheetData);
        
        console.log(`   ✅ Added to Google Sheets | ${licitacion.category} | Close: ${licitacion.bidding_close_date}`);
        processedCount++;

      } catch (error) {
        console.error(`   ❌ Error processing licitacion ${licitacion.id}:`, error.message);
        errorCount++;
      }
    }

    // Final summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 PROCESSING SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total pending licitaciones checked: ${pendingLicitaciones.length}`);
    console.log(`✅ Added to Google Sheets (open biddings): ${processedCount}`);
    console.log(`⏭️  Skipped (bidding closed): ${skippedBiddingClosed}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('='.repeat(50));

    if (processedCount > 0) {
      console.log(`\n🎉 SUCCESS! ${processedCount} unverified licitaciones with open biddings have been added to Google Sheets.`);
      console.log('💡 You can now review them in your Google Sheets and approve/reject them in the dashboard.');
    } else {
      console.log('\n📝 No action needed - all pending licitaciones either have closed biddings or are already processed.');
    }

  } catch (error) {
    logger.error('Error in processUnverifiedOpenBiddings:', error);
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the script
processUnverifiedOpenBiddings();