# Migration Guide: Import Existing Licitaciones to Dashboard

## Overview

This guide helps you import all existing licitaciones from Google Sheets into the dashboard database, so you can start using the approval workflow immediately.

## Prerequisites

✅ You must complete the database setup first:
1. Go to Supabase SQL Editor
2. Run the SQL from `quick-setup-with-sample.sql`
3. Verify the `licitaciones` table exists

## Quick Migration

### Option 1: Automatic Migration (Recommended)

Simply run:
```bash
npm run migrate
```

This will:
1. ✅ Read all data from your Google Sheet
2. ✅ Convert to dashboard format
3. ✅ Save to Supabase database
4. ✅ Show progress and statistics

**Expected output:**
```
🔄 Starting migration from Google Sheets to Dashboard Database

📋 Checking database table...
✅ Database table ready

📊 Reading data from Google Sheets...
✅ Found 590 rows in Google Sheets

🚀 Starting migration...
   ✓ Migrated 50 licitaciones...
   ✓ Migrated 100 licitaciones...
   ✓ Migrated 150 licitaciones...
   ...

📊 Migration Summary:
   ✅ Successfully migrated: 590
   ⏭️  Skipped (empty rows): 0
   ❌ Errors: 0

🎉 Migration complete!

🌐 View your dashboard at: http://localhost:4000

📈 Dashboard Statistics:
   Total: 590
   Pending: 590
   Approved: 0
   Rejected: 0
```

### Time Estimate
- **Small dataset** (< 100 rows): ~30 seconds
- **Medium dataset** (100-500 rows): ~1-2 minutes  
- **Large dataset** (500+ rows): ~2-5 minutes

## After Migration

### 1. View Your Dashboard
Open: http://localhost:4000

You'll see:
- All 590+ licitaciones as cards
- All marked as "Pending" status
- Filterable by category, priority, status
- Ready to approve/reject

### 2. Start Approving/Rejecting

For each licitación:
1. Review the card details
2. Click **✓ Aprobar** to approve
3. Or click **✗ Rechazar** to reject
4. Add optional notes
5. Decision is saved permanently

### 3. Use Filters

Filter to focus on what matters:
- **Status**: View only pending items
- **Category**: Focus on specific types
- **Priority**: Handle high-priority first

## Data Mapping

The migration reads from your Google Sheet columns:
```
Column A  → Email Date
Column B  → Email ID (unique identifier)
Column C  → Subject
Column D  → Location
Column E  → Description
Column F  → Summary
Column G  → Category
Column H  → Priority
Column I  → PDF Filename
Column J  → PDF Link (Google Drive)
Column K  → Site Visit Date
Column L  → Site Visit Time
Column M  → Visit Location
Column N  → Contact Name
Column O  → Contact Phone
Column P  → Bidding Close Date
Column Q  → Bidding Close Time
Column R  → Extraction Method
```

All data is preserved and properly formatted for the dashboard.

## Troubleshooting

### Error: "Could not find the table 'licitaciones'"

**Solution:** Run the database migration first:
```sql
-- In Supabase SQL Editor, run:
-- Copy from: quick-setup-with-sample.sql
```

### Error: "Spreadsheet not found"

**Solution:** Check your `.env` file:
```bash
GOOGLE_SHEET_ID=your_correct_sheet_id
```

### Error: "Unauthorized" or "Permission denied"

**Solution:** Your Google credentials may have expired:
```bash
npm run setup  # Re-authenticate
```

### Some Rows Skipped

This is normal. Empty rows or rows with invalid data are automatically skipped.
Check the summary at the end to see counts.

### Duplicate Email IDs

The migration uses `ON CONFLICT (email_id) DO UPDATE`, so:
- If a licitación already exists, it updates
- No duplicates are created
- You can safely run the migration multiple times

## Re-running Migration

You can run the migration again safely:
```bash
npm run migrate
```

It will:
- Update existing records
- Add any new records
- Not create duplicates

## Verifying Migration

### Check Database Directly

In Supabase:
1. Go to **Table Editor**
2. Select `licitaciones` table
3. Browse the rows

### Check via API

```bash
# Get total count
curl http://localhost:4000/api/stats

# Get all licitaciones
curl http://localhost:4000/api/licitaciones
```

### Check Dashboard

Open: http://localhost:4000
- See cards rendered
- Check statistics in header
- Try filtering

## Next Steps After Migration

1. **Review Pending Items**
   - Filter by `Status: Pending`
   - Start approving/rejecting

2. **Focus on Priorities**
   - Filter by `Priority: High`
   - Handle urgent items first

3. **Check Close Dates**
   - Look for upcoming deadlines
   - Prioritize accordingly

4. **Export Approved Items**
   - Filter by `Status: Approved`
   - Export for quote preparation

## Integration with Ongoing Processing

After migration:
- ✅ Old licitaciones: In dashboard (from migration)
- ✅ New licitaciones: Automatically added by agent
- ✅ Google Sheets: Still updated (unchanged)
- ✅ Google Drive: Still receiving PDFs (unchanged)

The dashboard is an **additional layer** for approval workflow.
Your existing processes continue working normally.

## Performance Notes

The migration:
- ✅ Processes in batches
- ✅ Shows progress updates
- ✅ Handles errors gracefully
- ✅ Uses database indexes for speed
- ✅ Can be interrupted and restarted

## Support

If you encounter issues:
1. Check the error message carefully
2. Verify prerequisites are met
3. Review troubleshooting section
4. Check logs: `logs/combined.log`

## Summary Commands

```bash
# Setup database (once)
# → Run quick-setup-with-sample.sql in Supabase

# Migrate data (once, or when needed)
npm run migrate

# Start dashboard (always running)
npm run dashboard

# Start email agent (always running)
npm start
```

---

**Ready to migrate? Run:**
```bash
npm run migrate
```



