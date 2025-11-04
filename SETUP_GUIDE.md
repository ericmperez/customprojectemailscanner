# 🚀 Quick Setup Guide

Follow these steps to get your Gmail Licitación Agent running in **15 minutes**!

## ⚡ Quick Start

### Step 1: Install Dependencies (2 min)

```bash
cd "/Users/ericperez/GMAIL Agent"
npm install
```

### Step 2: Create .env File (1 min)

```bash
cp env.template .env
```

### Step 3: Google Cloud Setup (5 min)

1. **Go to:** https://console.cloud.google.com/
2. **Create a project** or select existing
3. **Enable APIs:**
   - Gmail API
   - Google Sheets API
4. **Create OAuth Credentials:**
   - Go to: APIs & Services → Credentials
d   - Type: Desktop app
   - Redirect URI: `http://localhost:3000/oauth2callback`
5. **Copy:** Client ID & Client Secret to `.env`

### Step 4: Supabase Setup (3 min)

1. **Go to:** https://supabase.com/
2. **Create new project**
3. **Go to SQL Editor** and run:

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

4. **Copy:** Project URL & Anon Key to `.env` (Settings → API)

### Step 5: Google Sheets Setup (2 min)

1. **Create a new Google Sheet**
2. **Copy the Sheet ID** from URL:
   ```
   https://docs.google.com/spreadsheets/d/COPY_THIS_PART/edit
   ```
3. **Paste in `.env`** as `GOOGLE_SHEET_ID`

### Step 6: Authenticate (2 min)

```bash
npm run setup
```

- Opens browser
- Login with Google
- Grant permissions
- Token saved automatically ✅

### Step 7: Run! 🎉

```bash
npm start
```

## ✅ Checklist

Before running, ensure you have:

- [ ] Node.js 18+ installed
- [ ] All credentials in `.env` file
- [ ] Supabase table created
- [ ] Google Sheet created
- [ ] OAuth authentication completed (`npm run setup`)

## 🔍 Test It

Send yourself a test email:
- **Subject:** "Licitación: Proyecto de prueba"
- **Attachment:** Any PDF with location and description

Wait for next scheduled run or restart the agent to see it process immediately!

## 🆘 Common Issues

**"Missing required environment variables"**
→ Check all fields in `.env` are filled

**"invalid_grant"**
→ Run `npm run setup` again

**"Cannot access spreadsheet"**
→ Verify Sheet ID and that you have Editor access

**"Table does not exist"**
→ Run the SQL query in Supabase SQL Editor

## 📚 Full Documentation

See [README.md](README.md) for complete documentation.

---

**Need help?** Check the logs: `tail -f logs/combined.log`



