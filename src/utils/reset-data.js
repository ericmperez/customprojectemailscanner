import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { config } from '../config/credentials.js';
import logger from './logger.js';

async function resetData() {
  try {
    console.log('🧹 Starting data reset...\n');

    // 1. Clear Supabase processed_emails table
    console.log('📊 Clearing Supabase processed_emails table...');
    const supabase = createClient(config.supabase.url, config.supabase.key);
    
    const { error: deleteError } = await supabase
      .from('processed_emails')
      .delete()
      .neq('id', 0); // Delete all records

    if (deleteError) {
      console.error('Error clearing Supabase:', deleteError);
    } else {
      console.log('✅ Supabase table cleared\n');
    }

    // 2. Clear Google Sheet (keep headers, delete all data rows)
    console.log('📝 Clearing Google Sheet data rows...');
    const oauth2Client = new google.auth.OAuth2(
      config.gmail.clientId,
      config.gmail.clientSecret,
      config.gmail.redirectUri
    );

    oauth2Client.setCredentials({
      refresh_token: config.gmail.refreshToken,
    });

    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    const sheetName = config.sheets.sheetName;

    // Get the sheet to see how many rows exist
    const getResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: config.sheets.sheetId,
      range: `${sheetName}!A:R`,
    });

    const numRows = getResponse.data.values ? getResponse.data.values.length : 1;

    if (numRows > 1) {
      // Clear all rows except the header (row 1)
      await sheets.spreadsheets.values.clear({
        spreadsheetId: config.sheets.sheetId,
        range: `${sheetName}!A2:R${numRows}`,
      });
      console.log(`✅ Cleared ${numRows - 1} data rows from Google Sheet\n`);
    } else {
      console.log('✅ No data rows to clear in Google Sheet\n');
    }

    console.log('🎉 Data reset complete! Ready to reprocess emails from October 1st, 2025.\n');
    console.log('Run "npm start" to begin reprocessing with the new ciudad extraction.\n');

  } catch (error) {
    console.error('❌ Error during reset:', error);
    process.exit(1);
  }
}

resetData();

