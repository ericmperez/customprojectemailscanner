import { google } from 'googleapis';
import http from 'http';
import url from 'url';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REDIRECT_URI = process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/oauth2callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Error: GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be set in .env file');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file', // Google Drive access for PDF uploads
];

async function getAuthUrl() {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Force to get refresh token
  });
  return authUrl;
}

async function getTokenFromCode(code) {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

async function setupAuth() {
  console.log('🔐 Gmail, Google Sheets & Google Drive OAuth Setup');
  console.log('===================================================\n');

  const authUrl = await getAuthUrl();
  
  console.log('📋 Step 1: Open this URL in your browser:\n');
  console.log(authUrl);
  console.log('\n');

  // Start local server to receive callback
  const server = http.createServer(async (req, res) => {
    const queryData = url.parse(req.url, true).query;
    
    if (queryData.code) {
      try {
        const tokens = await getTokenFromCode(queryData.code);
        
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="font-family: Arial, sans-serif; padding: 50px; text-align: center;">
              <h1 style="color: green;">✅ Authentication Successful!</h1>
              <p>You can close this window and return to the terminal.</p>
              <p style="color: #666; margin-top: 30px;">Your refresh token has been saved.</p>
            </body>
          </html>
        `);

        console.log('\n✅ Authentication successful!');
        console.log('\n📝 Add this to your .env file:\n');
        console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
        
        // Optionally write to .env file
        const envPath = path.join(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
          let envContent = fs.readFileSync(envPath, 'utf8');
          
          if (envContent.includes('GMAIL_REFRESH_TOKEN=')) {
            envContent = envContent.replace(
              /GMAIL_REFRESH_TOKEN=.*/,
              `GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`
            );
          } else {
            envContent += `\nGMAIL_REFRESH_TOKEN=${tokens.refresh_token}\n`;
          }
          
          fs.writeFileSync(envPath, envContent);
          console.log('\n✅ .env file updated automatically!\n');
        }

        setTimeout(() => {
          server.close();
          process.exit(0);
        }, 1000);

      } catch (error) {
        console.error('❌ Error getting tokens:', error);
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>❌ Error</h1><p>Authentication failed. Check console.</p></body></html>');
        server.close();
        process.exit(1);
      }
    }
  });

  const PORT = process.env.AUTH_PORT || 3000;
  
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Error: Port ${PORT} is already in use.`);
      console.error(`   Please either:`);
      console.error(`   1. Kill the process using: lsof -ti:${PORT} | xargs kill -9`);
      console.error(`   2. Set a different port in .env: AUTH_PORT=3001`);
      process.exit(1);
    } else {
      console.error('❌ Server error:', err);
      process.exit(1);
    }
  });
  
  server.listen(PORT, () => {
    console.log(`🌐 Local server started on http://localhost:${PORT}`);
    console.log('⏳ Waiting for authentication...\n');
  });
}

setupAuth().catch(error => {
  console.error('❌ Setup failed:', error);
  process.exit(1);
});

