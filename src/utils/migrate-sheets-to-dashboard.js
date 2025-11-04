import dotenv from 'dotenv';
import SheetsService from '../services/sheets.service.js';
import LicitacionesService from '../services/licitaciones.service.js';
import logger from '../utils/logger.js';

dotenv.config();

/**
 * Migration script to import existing licitaciones from Google Sheets
 * into the dashboard database
 */

class SheetsMigration {
  constructor() {
    this.sheetsService = new SheetsService();
    this.licitacionesService = new LicitacionesService();
  }

  /**
   * Parse date string to timestamp
   */
  parseDate(dateStr) {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? null : date.toISOString();
    } catch (error) {
      return null;
    }
  }

  /**
   * Convert Google Sheets row to licitacion data
   */
  rowToLicitacion(row, index) {
    // Expected columns based on your sheets service:
    // [emailDate, emailId, subject, location, description, summary, category, priority,
    //  pdfFilename, pdfLink, siteVisitDate, siteVisitTime, visitLocation,
    //  contactName, contactPhone, biddingCloseDate, biddingCloseTime, extractionMethod]

    const [
      emailDate,
      emailId,
      subject,
      location,
      description,
      summary,
      category,
      priority,
      pdfFilename,
      pdfLink,
      siteVisitDate,
      siteVisitTime,
      visitLocation,
      contactName,
      contactPhone,
      biddingCloseDate,
      biddingCloseTime,
      extractionMethod,
    ] = row;

    // Use a fallback email_id if not present
    const finalEmailId = emailId || `migrated_${Date.now()}_${index}`;

    return {
      emailId: finalEmailId,
      emailDate: this.parseDate(emailDate),
      subject: subject || 'Sin título',
      location: location || null,
      description: description || null,
      summary: summary || null,
      category: category || 'No clasificado',
      priority: priority || 'Medium',
      pdfFilename: pdfFilename || null,
      pdfLink: pdfLink || null,
      siteVisitDate: siteVisitDate || null,
      siteVisitTime: siteVisitTime || null,
      visitLocation: visitLocation || null,
      contactName: contactName || null,
      contactPhone: contactPhone || null,
      biddingCloseDate: biddingCloseDate || null,
      biddingCloseTime: biddingCloseTime || null,
      extractionMethod: extractionMethod || 'Unknown',
    };
  }

  /**
   * Migrate all data from Google Sheets to database
   */
  async migrate() {
    console.log('\n🔄 Starting migration from Google Sheets to Dashboard Database\n');
    console.log('=' .repeat(70));

    try {
      // Ensure table exists
      console.log('📋 Checking database table...');
      await this.licitacionesService.ensureTableExists();
      console.log('✅ Database table ready\n');

      // Get all data from Google Sheets
      console.log('📊 Reading data from Google Sheets...');
      const sheets = await this.sheetsService.sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetsService.spreadsheetId,
        range: `${this.sheetsService.sheetName}!A2:R`, // Skip header row
      });

      const rows = sheets.data.values;

      if (!rows || rows.length === 0) {
        console.log('⚠️  No data found in Google Sheets');
        return;
      }

      console.log(`✅ Found ${rows.length} rows in Google Sheets\n`);

      // Migrate each row
      let successCount = 0;
      let skipCount = 0;
      let errorCount = 0;

      console.log('🚀 Starting migration...\n');

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        
        // Skip empty rows
        if (!row || row.length === 0 || !row[0]) {
          skipCount++;
          continue;
        }

        try {
          const licitacionData = this.rowToLicitacion(row, i);
          
          // Save to database
          await this.licitacionesService.saveLicitacion(licitacionData);
          
          successCount++;
          
          // Show progress every 50 rows
          if (successCount % 50 === 0) {
            console.log(`   ✓ Migrated ${successCount} licitaciones...`);
          }
        } catch (error) {
          errorCount++;
          
          // Show first few errors, then summarize
          if (errorCount <= 3) {
            console.error(`   ✗ Error on row ${i + 2}:`, error.message);
          }
        }
      }

      // Summary
      console.log('\n' + '=' .repeat(70));
      console.log('\n📊 Migration Summary:');
      console.log(`   ✅ Successfully migrated: ${successCount}`);
      console.log(`   ⏭️  Skipped (empty rows): ${skipCount}`);
      console.log(`   ❌ Errors: ${errorCount}`);
      console.log(`\n🎉 Migration complete!`);
      console.log(`\n🌐 View your dashboard at: http://localhost:4000\n`);

      // Get final stats
      const stats = await this.licitacionesService.getStats();
      console.log('📈 Dashboard Statistics:');
      console.log(`   Total: ${stats.total}`);
      console.log(`   Pending: ${stats.pending}`);
      console.log(`   Approved: ${stats.approved}`);
      console.log(`   Rejected: ${stats.rejected}\n`);

    } catch (error) {
      console.error('\n❌ Migration failed:', error);
      console.error('\nMake sure:');
      console.error('  1. You have run the database migration (quick-setup-with-sample.sql)');
      console.error('  2. Your Google Sheets credentials are valid');
      console.error('  3. Your Supabase credentials are correct\n');
      throw error;
    }
  }
}

// Run migration
async function main() {
  const migration = new SheetsMigration();
  
  try {
    await migration.migrate();
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();



