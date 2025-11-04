# Licitaciones Dashboard

## Overview

A modern, card-based dashboard for reviewing and approving/rejecting licitaciones (bids) extracted from Gmail.

## Features

- 📊 **Real-time Statistics** - View total, pending, approved, and rejected licitaciones
- 🎴 **Card-based UI** - Each licitación displayed as a comprehensive card
- 🔍 **Advanced Filtering** - Filter by status, category, and priority
- ✅ **Approval Workflow** - Approve or reject licitaciones with optional notes
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile devices
- 🎨 **Modern UI** - Beautiful gradient design with smooth animations

## Setup

### 1. Database Migration

Run the SQL migration in your Supabase dashboard to create the `licitaciones` table:

```bash
# The migration file is located at:
./supabase-migration.sql
```

Steps:
1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `supabase-migration.sql`
4. Execute the SQL

### 2. Environment Configuration

Add the dashboard port to your `.env` file:

```bash
DASHBOARD_PORT=4000
```

### 3. Start the Dashboard

```bash
npm run dashboard
```

The dashboard will be available at: `http://localhost:4000`

## Usage

### Viewing Licitaciones

1. Open `http://localhost:4000` in your browser
2. Cards will display with all relevant information:
   - Subject and status
   - Location and description
   - Bidding close date and time
   - Site visit information
   - Contact details
   - PDF link

### Filtering

Use the filter dropdowns to narrow down results:
- **Status**: All, Pending, Approved, Rejected
- **Category**: All, Suministros, Servicios, Construcción, Obras
- **Priority**: All, High, Medium, Low

### Approving/Rejecting

1. Click **✓ Aprobar** to approve a licitación
2. Click **✗ Rechazar** to reject a licitación
3. (Optional) Add notes in the modal that appears
4. Click **Confirmar** to save your decision

### Resetting Status

If you need to reconsider a licitación:
1. Find the approved/rejected card
2. Click **↺ Volver a Pendiente**
3. The licitación will return to pending status

## API Endpoints

The dashboard server provides a RESTful API:

### GET /api/licitaciones
Get all licitaciones with optional filtering

Query parameters:
- `status` - Filter by approval status (pending, approved, rejected)
- `category` - Filter by category
- `priority` - Filter by priority

Example:
```
GET /api/licitaciones?status=pending&category=Suministros
```

### GET /api/licitaciones/:id
Get a single licitación by ID

### PATCH /api/licitaciones/:id/approve
Approve a licitación

Body:
```json
{
  "notes": "Optional approval notes"
}
```

### PATCH /api/licitaciones/:id/reject
Reject a licitación

Body:
```json
{
  "notes": "Optional rejection notes"
}
```

### PATCH /api/licitaciones/:id/pending
Reset a licitación to pending status

### GET /api/stats
Get dashboard statistics

Response:
```json
{
  "success": true,
  "data": {
    "total": 100,
    "pending": 45,
    "approved": 40,
    "rejected": 15
  }
}
```

## Integration with Main Agent

The main Gmail agent (`npm start`) automatically saves all processed licitaciones to the database with `approval_status: 'pending'`. This happens in addition to:
1. Adding data to Google Sheets (if bidding is still open)
2. Uploading PDFs to Google Drive
3. Marking emails as processed in Supabase

## Architecture

```
src/
├── dashboard/
│   ├── server.js              # Express API server
│   └── public/
│       ├── index.html         # Dashboard UI
│       ├── styles.css         # Styling
│       └── app.js             # Frontend JavaScript
├── services/
│   └── licitaciones.service.js # Database operations
└── index.js                   # Main agent (updated to save to licitaciones table)
```

## Customization

### Styling

Edit `src/dashboard/public/styles.css` to customize colors, fonts, and layouts.

### Categories and Priorities

Add new options in `src/dashboard/public/index.html`:

```html
<!-- Add new category -->
<option value="YourCategory">Your Category</option>

<!-- Add new priority -->
<option value="Custom">Custom Priority</option>
```

### API Extensions

Add new endpoints in `src/dashboard/server.js` to extend functionality.

## Troubleshooting

### Port Already in Use

If port 4000 is already in use:
1. Stop the process using port 4000: `lsof -ti:4000 | xargs kill`
2. Or change `DASHBOARD_PORT` in your `.env` file

### Cannot Connect to Supabase

1. Verify your `SUPABASE_URL` and `SUPABASE_KEY` in `.env`
2. Ensure the migration has been run
3. Check Supabase dashboard for any errors

### No Data Showing

1. Ensure the main agent (`npm start`) has processed some emails
2. Check that licitaciones are being saved to the database
3. Check browser console for any JavaScript errors

## Production Deployment

### Option 1: Vercel (Recommended - FREE)

Deploy the dashboard to Vercel for free:

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
npm run vercel:prod
```

**📖 Full Guide**: See [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) for complete instructions.

Benefits:
- ✅ Free hosting
- ✅ Automatic HTTPS
- ✅ Global CDN
- ✅ Automatic scaling
- ✅ Zero configuration

### Option 2: VPS/Server

For traditional server deployment:

1. **Use Environment Variables**
   ```bash
   DASHBOARD_PORT=80
   NODE_ENV=production
   ```

2. **Use Process Manager**
   ```bash
   # Using PM2
   pm2 start src/dashboard/server.js --name "licitaciones-dashboard"
   ```

3. **Set up HTTPS**
   - Use a reverse proxy (nginx, Caddy)
   - Obtain SSL certificates (Let's Encrypt)

4. **Enable CORS Restrictions**
   Edit `src/dashboard/server.js` to limit allowed origins:
   ```javascript
   app.use(cors({
     origin: 'https://yourdomain.com'
   }));
   ```

5. **Add Authentication**
   Consider adding authentication middleware for production use.

## Support

For issues or questions, check:
- Application logs: `logs/combined.log`
- Browser console for frontend errors
- Supabase dashboard for database issues



