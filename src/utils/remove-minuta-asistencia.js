import SheetsService from '../services/sheets.service.js';
import logger from './logger.js';

/**
 * Remove all rows from Google Sheets that contain "minuta" or "asistencia"
 * in the PDF filename (Archivo PDF column)
 */
async function removeMinutaAsistencia() {
  try {
    console.log('🔍 Scanning Google Sheets for minuta/asistencia entries...\n');

    const sheetsService = new SheetsService();
    
    // Get all licitaciones from the sheet
    const licitaciones = await sheetsService.getLicitaciones();
    console.log(`📊 Found ${licitaciones.length} total rows\n`);

    // Filter rows that contain minuta or asistencia in the PDF filename
    const rowsToDelete = [];
    
    for (const lic of licitaciones) {
      const pdfFilenameLower = (lic.pdfFilename || '').toLowerCase();
      
      const isMinutaOrAsistencia = 
        pdfFilenameLower.includes('minuta') || 
        pdfFilenameLower.includes('asistencia');

      if (isMinutaOrAsistencia) {
        rowsToDelete.push({
          rowNumber: lic.rowNumber,
          subject: lic.subject,
          pdfFilename: lic.pdfFilename
        });
      }
    }

    if (rowsToDelete.length === 0) {
      console.log('✅ No minuta/asistencia entries found. Sheet is clean!');
      return;
    }

    console.log(`🗑️  Found ${rowsToDelete.length} rows to delete:\n`);
    
    // Display rows that will be deleted
    rowsToDelete.forEach((row, index) => {
      console.log(`${index + 1}. Row ${row.rowNumber}: ${row.pdfFilename} (${row.subject})`);
    });

    console.log('\n⚠️  Starting deletion process...\n');

    // Delete rows in reverse order (from bottom to top)
    // This prevents row number shifting issues
    const sortedRows = rowsToDelete.sort((a, b) => b.rowNumber - a.rowNumber);
    
    let deletedCount = 0;
    let errorCount = 0;

    for (const row of sortedRows) {
      try {
        await sheetsService.deleteLicitacion(row.rowNumber);
        console.log(`✅ Deleted row ${row.rowNumber}: ${row.pdfFilename}`);
        deletedCount++;
      } catch (error) {
        console.error(`❌ Error deleting row ${row.rowNumber}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n=== Cleanup Summary ===');
    console.log(`✅ Successfully deleted: ${deletedCount} rows`);
    console.log(`❌ Errors: ${errorCount} rows`);
    console.log(`📊 Remaining rows: ${licitaciones.length - deletedCount}`);
    console.log('======================\n');

    logger.info('Minuta/Asistencia cleanup completed', {
      deleted: deletedCount,
      errors: errorCount,
      remaining: licitaciones.length - deletedCount
    });

  } catch (error) {
    console.error('❌ Fatal error during cleanup:', error);
    logger.error('Minuta/Asistencia cleanup failed', error);
    throw error;
  }
}

// Run the cleanup
removeMinutaAsistencia()
  .then(() => {
    console.log('✅ Cleanup completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  });

