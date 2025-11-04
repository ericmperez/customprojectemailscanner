import { LicitacionAgent } from '../index.js';
import SupabaseService from '../services/supabase.service.js';
import LicitacionesService from '../services/licitaciones.service.js';
import GmailService from '../services/gmail.service.js';
import PDFService from '../services/pdf.service.js';
import logger from '../utils/logger.js';

/**
 * Populate licitaciones table with real data from recently processed emails
 * This script will take emails that were just processed and create proper licitacion records
 * for the dashboard
 */
async function populateRealData() {
  try {
    console.log('📊 Populating licitaciones table with real processed email data...\n');

    // Initialize services
    const supabaseService = new SupabaseService();
    const licitacionesService = new LicitacionesService();
    const gmailService = new GmailService();
    const pdfService = new PDFService();

    console.log('✅ Services initialized');

    // Get all processed emails from the last 30 days
    const { data: processedEmails, error } = await supabaseService.supabase
      .from('processed_emails')
      .select('*')
      .gte('processed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('processed_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching processed emails:', error);
      return;
    }

    if (!processedEmails || processedEmails.length === 0) {
      console.log('❌ No processed emails found in the last 30 days');
      return;
    }

    console.log(`📋 Found ${processedEmails.length} processed emails to migrate\n`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < processedEmails.length; i++) {
      const processedEmail = processedEmails[i];
      
      try {
        console.log(`[${i + 1}/${processedEmails.length}] Processing: ${processedEmail.subject}`);

        // Check if already exists in licitaciones table
        const { data: existingLicitacion, error: checkError } = await licitacionesService.supabase
          .from('licitaciones')
          .select('id')
          .eq('email_id', processedEmail.email_id)
          .single();

        if (existingLicitacion) {
          console.log('   ⏭️  Already exists in licitaciones table');
          skippedCount++;
          continue;
        }

        // Get the full email details to extract more data
        const emailDetails = await gmailService.getEmailDetails(processedEmail.email_id);
        
        // Try to get PDF data if we have attachments
        let pdfData = {
          location: processedEmail.location || 'No especificada',
          description: processedEmail.description || 'No disponible',
          summary: '',
          category: 'No clasificado',
          priority: 'Medium',
          siteVisitDate: 'No especificada',
          siteVisitTime: 'No especificada',
          visitLocation: 'No especificada',
          contactName: 'No disponible',
          contactPhone: 'No disponible',
          biddingCloseDate: 'No especificada',
          biddingCloseTime: 'No especificada',
          extractionMethod: 'Migration'
        };

        // If email has attachments, try to re-extract PDF data
        if (emailDetails.attachments && emailDetails.attachments.length > 0) {
          try {
            const attachment = emailDetails.attachments[0]; // Take first PDF
            const extractedPdfData = await pdfService.processPDFAttachment(attachment);
            
            // Merge extracted data with defaults
            pdfData = {
              ...pdfData,
              ...extractedPdfData,
              extractionMethod: extractedPdfData.extractionMethod || 'Migration'
            };
            
            console.log(`   📄 PDF data extracted: ${pdfData.category}`);
          } catch (pdfError) {
            console.log(`   ⚠️  Could not re-extract PDF data, using basic info`);
          }
        }

        // Create licitacion record
        const licitacionData = {
          emailId: processedEmail.email_id,
          emailDate: emailDetails.date,
          subject: emailDetails.subject,
          location: pdfData.location,
          description: pdfData.description,
          summary: pdfData.summary || `${pdfData.category} - ${pdfData.location}`,
          category: pdfData.category,
          priority: pdfData.priority,
          pdfFilename: processedEmail.pdf_filename || 'archivo.pdf',
          pdfLink: '#', // We'll set this later if needed
          siteVisitDate: pdfData.siteVisitDate,
          siteVisitTime: pdfData.siteVisitTime,
          visitLocation: pdfData.visitLocation,
          contactName: pdfData.contactName,
          contactPhone: pdfData.contactPhone,
          biddingCloseDate: pdfData.biddingCloseDate,
          biddingCloseTime: pdfData.biddingCloseTime,
          extractionMethod: pdfData.extractionMethod,
        };

        // Save to licitaciones table
        await licitacionesService.saveLicitacion(licitacionData);
        
        console.log(`   ✅ Migrated: ${pdfData.category} | ${pdfData.biddingCloseDate}`);
        migratedCount++;

        // Add small delay to avoid overwhelming the API
        if (i % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.error(`   ❌ Error migrating ${processedEmail.email_id}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total processed emails: ${processedEmails.length}`);
    console.log(`✅ Successfully migrated: ${migratedCount}`);
    console.log(`⏭️  Skipped (already exists): ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('='.repeat(50));

    if (migratedCount > 0) {
      console.log(`\n🎉 SUCCESS! ${migratedCount} licitaciones are now available in the dashboard.`);
      console.log('\n🚀 To start the dashboard, run:');
      console.log('   npm run dashboard');
      console.log('\n📱 Dashboard will be available at: http://localhost:4000');
    }

  } catch (error) {
    logger.error('Error in populateRealData:', error);
    console.error('❌ Fatal error:', error.message);
  }
}

// Run the migration
populateRealData();