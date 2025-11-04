import { google } from 'googleapis';
import { config } from '../config/credentials.js';

async function addHeaders() {
  try {
    console.log('📋 Adding column headers to Google Sheet...\n');

    const oauth2Client = new google.auth.OAuth2(
      config.gmail.clientId,
      config.gmail.clientSecret,
      config.gmail.redirectUri
    );

    oauth2Client.setCredentials({
      refresh_token: config.gmail.refreshToken,
    });

    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    const headers = [
      'Fecha de Procesamiento',
      'Fecha del Email',
      'Asunto',
      'Ubicación',
      'Descripción',
      'Resumen',
      'Categoría',
      'Prioridad',
      'Archivo PDF',
      'Ver PDF',
      'Fecha Site Visit',
      'Hora Site Visit',
      'Lugar de Visita',
      'Nombre Contacto',
      'Teléfono Contacto',
      'Fecha Cierre Licitación',
      'Hora Cierre Licitación',
      'Método Extracción',
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: config.sheets.sheetId,
      range: 'Licitaciones!A1:R1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [headers],
      },
    });

    console.log('✅ Headers added successfully!');
    console.log(`📊 Total columns: ${headers.length}`);
    console.log('\nHeaders:');
    headers.forEach((header, index) => {
      console.log(`   ${index + 1}. ${header}`);
    });

  } catch (error) {
    console.error('❌ Error adding headers:', error);
    process.exit(1);
  }
}

addHeaders();

