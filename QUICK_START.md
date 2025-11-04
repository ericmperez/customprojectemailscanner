# Quick Start Guide - Licitaciones Dashboard

## 🎯 Your Dashboard is Ready!

### Access Your Dashboard

Open your browser and go to:
```
http://localhost:4000
```

## ⚠️ Important: Database Setup Required

Before the dashboard can show data, you need to create the database table:

### Step 1: Run the Database Migration

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Select your project: `ktujwmmcokkodezihggd`
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy and paste the contents of `supabase-migration.sql`
6. Click **Run** to execute the SQL

This creates the `licitaciones` table where all your bid data will be stored for the dashboard.

## 📊 How It Works

### Current System Status

✅ **Main Agent Running** - Processing emails every 60 minutes
- Port: Background process
- Logs: `logs/combined.log`

✅ **Dashboard Server Running** - Approval interface
- URL: http://localhost:4000
- API: http://localhost:4000/api

### Data Flow

```
Gmail → Extract PDF → Save to 3 places:
├── 1. Google Sheets (if bidding still open)
├── 2. Google Drive (PDF upload)
└── 3. Supabase licitaciones table (for dashboard) ✨ NEW
```

## 🎴 Dashboard Features

### View Licitaciones
- Each licitación displayed as a beautiful card
- Shows all relevant info: location, dates, contacts, PDF link
- Color-coded by status (pending/approved/rejected)

### Filter & Sort
- **Status**: Pending, Approved, Rejected
- **Category**: Suministros, Servicios, Construcción, Obras
- **Priority**: High, Medium, Low

### Approve or Reject
1. Click **✓ Aprobar** to approve
2. Click **✗ Rechazar** to reject
3. Add optional notes
4. Decision is saved permanently

### Reset Status
- Click **↺ Volver a Pendiente** to reconsider any decision

## 📈 Real-time Stats

Top bar shows:
- **Total** licitaciones in system
- **Pending** awaiting your review
- **Approved** for quote preparation
- **Rejected** not pursuing

## 🔄 What Happens Next

### New Emails
When new licitación emails arrive:
1. Main agent extracts data (every 60 minutes)
2. Saves to licitaciones table with status: `pending`
3. Appears immediately in dashboard
4. You review and approve/reject

### Existing Emails
Currently processed emails (~590) are already in:
- ✅ Google Sheets
- ✅ Google Drive
- ❌ NOT in licitaciones table yet (they were processed before dashboard existed)

To migrate existing data, you can:
1. Wait for agent to find new emails (automatic)
2. Or run a migration script (I can create this if needed)

## 🛠️ Commands

### Start Dashboard
```bash
npm run dashboard
```

### Start Main Agent
```bash
npm start
```

### View Logs
```bash
tail -f logs/combined.log
```

### Check Running Processes
```bash
ps aux | grep node
```

### Stop Services
```bash
# Find process IDs
ps aux | grep node

# Kill specific process
kill <PID>

# Or kill all node processes (careful!)
killall node
```

## 🌐 API Reference

### Get All Licitaciones
```bash
curl http://localhost:4000/api/licitaciones

# With filters
curl "http://localhost:4000/api/licitaciones?status=pending&category=Suministros"
```

### Get Statistics
```bash
curl http://localhost:4000/api/stats
```

### Approve a Licitación
```bash
curl -X PATCH http://localhost:4000/api/licitaciones/1/approve \
  -H "Content-Type: application/json" \
  -d '{"notes": "Good opportunity"}'
```

### Reject a Licitación
```bash
curl -X PATCH http://localhost:4000/api/licitaciones/1/reject \
  -H "Content-Type: application/json" \
  -d '{"notes": "Not our specialty"}'
```

## 📱 Mobile Friendly

The dashboard is fully responsive and works great on:
- 💻 Desktop
- 📱 Mobile phones
- 📲 Tablets

## 🎨 Modern UI

- Beautiful gradient background
- Smooth animations
- Card-based layout
- Color-coded statuses
- Real-time updates

## ⚡ Production-Ready Features

✅ RESTful API
✅ Supabase database
✅ Error handling
✅ Logging
✅ CORS enabled
✅ Responsive design
✅ Modal dialogs
✅ Filtering & sorting
✅ Real-time stats

## 🔧 Configuration

All settings in `.env`:
```bash
DASHBOARD_PORT=4000        # Dashboard web server port
SUPABASE_URL=...           # Your Supabase project URL
SUPABASE_KEY=...           # Your Supabase API key
```

## 📞 Support

- Full documentation: `DASHBOARD_README.md`
- Setup guide: `SETUP_GUIDE.md`
- Main README: `README.md`

## 🚀 Next Steps

1. **Run the database migration** (Step 1 above) ⚠️ REQUIRED
2. Open http://localhost:4000 in your browser
3. Wait for new emails to arrive (or I can help migrate existing data)
4. Start approving/rejecting licitaciones!

---

**Everything is running and ready to go! 🎉**

Just complete the database migration and you're all set.



