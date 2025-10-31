# 📧 Gmail Licitación Agent

Automated system that monitors Gmail for emails starting with "Licitación", extracts PDF content (location and bidding description), and updates Google Sheets automatically.

## 🚀 Features

- ✅ **Automated Gmail Monitoring** - Scans inbox every 1-2 hours (configurable)
- ✅ **Smart PDF Extraction** - Extracts location and bidding description from PDFs
- ✅ **Google Sheets Integration** - Automatically appends new rows with extracted data
- ✅ **Duplicate Prevention** - Tracks processed emails using Supabase
- ✅ **Production Ready** - Comprehensive error handling and logging
- ✅ **Configurable Schedule** - Set custom intervals via environment variables
- ✅ **OAuth2 Secure Authentication** - Uses Google's official OAuth2 flow

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js** 18+ installed
- **Gmail account** with API access
- **Google Cloud Project** with Gmail & Sheets APIs enabled
- **Supabase account** (free tier works)
- **Google Sheet** created for storing results

## 🛠️ Setup Instructions

### 1. Clone and Install Dependencies

```bash
cd "/Users/ericperez/GMAIL Agent"
npm install
```

### 2. Configure Google Cloud Project

#### Create a Google Cloud Project:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the following APIs:
   - Gmail API
   - Google Sheets API

#### Create OAuth2 Credentials:
1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Choose **Desktop app** or **Web application**
4. Add authorized redirect URI: `http://localhost:3000/oauth2callback`
5. Download the credentials JSON or copy:
   - Client ID
   - Client Secret

### 3. Set Up Supabase Database

1. Go to [Supabase](https://supabase.com/) and create a new project
2. Go to **SQL Editor** and run this query:

```sql
CREATE TABLE processed_emails (
  id SERIAL PRIMARY KEY,
  email_id VARCHAR(255) UNIQUE NOT NULL,
  subject TEXT,
  processed_at TIMESTAMP DEFAULT NOW(),
  location TEXT,
  description TEXT,
  pdf_filename TEXT
);

CREATE INDEX idx_email_id ON processed_emails(email_id);
```

3. Get your Supabase credentials:
   - Project URL
   - Anon/Public Key (from Settings > API)

### 4. Create Google Sheet

1. Create a new Google Sheet
2. Copy the Sheet ID from the URL:
   - `https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit`
3. Make sure the Google account you'll authenticate with has **Editor** access

### 5. Configure Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` and fill in your credentials:

```env
# Gmail API Credentials (from Google Cloud Console)
GMAIL_CLIENT_ID=your_client_id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your_client_secret
GMAIL_REDIRECT_URI=http://localhost:3000/oauth2callback

# Google Sheets Configuration
GOOGLE_SHEET_ID=your_google_sheet_id
SHEET_NAME=Licitaciones

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key

# Scheduler Configuration (in minutes)
SCHEDULE_INTERVAL_MINUTES=60

# Application Settings
NODE_ENV=production
LOG_LEVEL=info
```

### 6. Authenticate with Google

Run the OAuth setup script:

```bash
npm run setup
```

This will:
1. Open a browser window for Google authentication
2. Ask you to grant permissions for Gmail and Sheets access
3. Automatically save your refresh token to `.env`

## 🎯 Usage

### Start the Agent (Scheduled Mode)

Run the agent with automatic scheduling:

```bash
npm start
```

The agent will:
- Run immediately on startup
- Process all new Licitación emails
- Run automatically every N minutes (configured in `SCHEDULE_INTERVAL_MINUTES`)
- Continue running until stopped with `Ctrl+C`

### Development Mode (Auto-Restart)

For development with auto-restart on file changes:

```bash
npm run dev
```

## 📊 How It Works

### Email Processing Flow

1. **🔍 Search Gmail**
   - Searches for emails with subject starting with "Licitación"
   - Filters for emails with PDF attachments
   - Returns unprocessed emails only

2. **📥 Download PDFs**
   - Extracts PDF attachments from matched emails
   - Converts base64 encoded attachments to buffers

3. **🔎 Extract Data**
   - Parses PDF content using OCR-like extraction
   - Identifies **Location** using patterns like:
     - "Ubicación:", "Lugar:", "Localidad:", "Dirección:"
   - Identifies **Description** using patterns like:
     - "Objeto:", "Descripción:", "Asunto:"

4. **📝 Update Google Sheets**
   - Appends new row with extracted data:
     - Processing Date
     - Email Date
     - Email Subject
     - Location
     - Description
     - PDF Filename

5. **✅ Mark as Processed**
   - Stores email ID in Supabase to prevent duplicates
   - Marks email as read in Gmail (optional)

### Data Structure in Google Sheets

| Fecha de Procesamiento | Fecha del Email | Asunto | Ubicación | Descripción | Archivo PDF |
|------------------------|-----------------|--------|-----------|-------------|-------------|
| 2025-10-31 14:30:00 | 2025-10-31 10:15:00 | Licitación: Construcción de puente | Madrid, España | Construcción y mantenimiento de infraestructura vial | licitacion_001.pdf |

## 🔧 Configuration Options

### Schedule Intervals

Edit `SCHEDULE_INTERVAL_MINUTES` in `.env`:

- **60** = Every 1 hour
- **120** = Every 2 hours
- **30** = Every 30 minutes
- **180** = Every 3 hours

### Log Levels

Edit `LOG_LEVEL` in `.env`:

- **error** - Only errors
- **warn** - Warnings and errors
- **info** - General information (recommended)
- **debug** - Detailed debugging info

## 📝 Logs

Logs are stored in the `logs/` directory:

- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only

Console output shows real-time colored logs with timestamps.

## 🐛 Troubleshooting

### Authentication Issues

**Problem:** "Missing required environment variables"
- **Solution:** Ensure all variables in `.env` are filled out
- Run `npm run setup` again to get a new refresh token

**Problem:** "invalid_grant" error
- **Solution:** Your refresh token expired. Run `npm run setup` again

### PDF Extraction Issues

**Problem:** "Could not extract location/description"
- **Solution:** The PDF format might be different. Check `logs/combined.log` to see the raw text extracted
- Modify patterns in `src/services/pdf.service.js` to match your PDF format

### Google Sheets Issues

**Problem:** "The caller does not have permission"
- **Solution:** Make sure your Google account has Editor access to the Sheet
- Verify `GOOGLE_SHEET_ID` is correct in `.env`

### Supabase Issues

**Problem:** "Table does not exist"
- **Solution:** Run the SQL query from Step 3 in Supabase SQL Editor

## 🔒 Security Best Practices

1. ✅ **Never commit `.env` file** - It's in `.gitignore`
2. ✅ **Use environment variables** - Don't hardcode credentials
3. ✅ **Rotate refresh tokens** - Regenerate periodically
4. ✅ **Limit API scopes** - Only request necessary permissions
5. ✅ **Use Supabase RLS** - Enable Row Level Security in production

## 📦 Project Structure

```
/GMAIL Agent
├── src/
│   ├── config/
│   │   └── credentials.js          # Environment configuration
│   ├── services/
│   │   ├── gmail.service.js        # Gmail API integration
│   │   ├── pdf.service.js          # PDF parsing & extraction
│   │   ├── sheets.service.js       # Google Sheets API
│   │   ├── supabase.service.js     # Database tracking
│   │   └── scheduler.service.js    # Cron job scheduler
│   ├── setup/
│   │   └── auth.js                 # OAuth2 setup script
│   ├── utils/
│   │   └── logger.js               # Winston logger
│   └── index.js                    # Main entry point
├── logs/                           # Log files
├── .env                            # Environment variables (DO NOT COMMIT)
├── .env.example                    # Template for .env
├── .gitignore                      # Git ignore rules
├── package.json                    # Dependencies
└── README.md                       # This file
```

## 🚀 Production Deployment

### Option 1: VPS/Cloud Server (Recommended)

Deploy on any VPS (DigitalOcean, AWS EC2, etc.):

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and setup
git clone <your-repo>
cd "GMAIL Agent"
npm install
# Copy .env file with production credentials

# Run with PM2 (process manager)
npm install -g pm2
pm2 start src/index.js --name gmail-agent
pm2 startup  # Enable on boot
pm2 save
```

### Option 2: Docker

Create `Dockerfile`:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
CMD ["npm", "start"]
```

Run:
```bash
docker build -t gmail-agent .
docker run -d --env-file .env --name gmail-agent gmail-agent
```

### Option 3: Cloud Functions

Deploy as a scheduled cloud function on:
- **Google Cloud Functions** (recommended for Google APIs)
- **AWS Lambda** with EventBridge
- **Azure Functions**

## 📈 Monitoring & Maintenance

### Check Status

```bash
# View logs
tail -f logs/combined.log

# Check processing stats (in Node.js console)
const agent = new LicitacionAgent();
await agent.initialize();
const stats = await agent.supabaseService.getProcessingStats();
console.log(stats);
```

### Cleanup Old Records

Add to your cron or run manually:

```javascript
// Clean up records older than 90 days
await agent.supabaseService.cleanupOldRecords(90);
```

## 🤝 Support

For issues or questions:
1. Check logs in `logs/combined.log`
2. Verify all environment variables are set correctly
3. Test OAuth authentication with `npm run setup`
4. Check Supabase table exists and has correct schema

## 📄 License

ISC

## 🎉 Credits

Built with:
- [googleapis](https://github.com/googleapis/google-api-nodejs-client) - Google APIs
- [pdf-parse](https://www.npmjs.com/package/pdf-parse) - PDF extraction
- [node-cron](https://github.com/node-cron/node-cron) - Task scheduling
- [Supabase](https://supabase.com/) - Database
- [Winston](https://github.com/winstonjs/winston) - Logging

---

**Made with ❤️ for automated licitación processing**

