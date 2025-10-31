import dotenv from 'dotenv';

dotenv.config();

export const config = {
  gmail: {
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    redirectUri: process.env.GMAIL_REDIRECT_URI,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN,
  },
  sheets: {
    sheetId: process.env.GOOGLE_SHEET_ID,
    sheetName: process.env.SHEET_NAME || 'Licitaciones',
  },
  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_KEY,
  },
  scheduler: {
    intervalMinutes: parseInt(process.env.SCHEDULE_INTERVAL_MINUTES || '60', 10),
  },
  app: {
    env: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
  },
};

// Validate required configuration
export function validateConfig() {
  const required = {
    'GMAIL_CLIENT_ID': config.gmail.clientId,
    'GMAIL_CLIENT_SECRET': config.gmail.clientSecret,
    'GMAIL_REFRESH_TOKEN': config.gmail.refreshToken,
    'GOOGLE_SHEET_ID': config.sheets.sheetId,
    'SUPABASE_URL': config.supabase.url,
    'SUPABASE_KEY': config.supabase.key,
  };

  const missing = Object.entries(required)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

