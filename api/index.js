import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { param, body, validationResult } from 'express-validator';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import LicitacionesService from './services/licitaciones.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ---------------------------------------------------------------------------
// Security middleware
// ---------------------------------------------------------------------------

// Helmet — security headers with CSP for self-hosted dashboard
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://*.supabase.co'],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// CORS — origin whitelist
const allowedOrigins = (() => {
  const envOrigins = process.env.ALLOWED_ORIGINS;
  if (envOrigins) {
    return envOrigins.split(',').map((o) => o.trim()).filter(Boolean);
  }
  // Defaults: allow localhost for dev
  return ['http://localhost:3000', 'http://localhost:4000'];
})();

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no origin (curl, server-to-server, same-origin)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
  })
);

app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const validateId = [
  param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer'),
];

const validateNotes = [
  body('notes')
    .optional()
    .isString()
    .isLength({ max: 5000 })
    .withMessage('Notes must be a string (max 5000 chars)'),
];

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
}

// ---------------------------------------------------------------------------
// Helper: safe error response
// ---------------------------------------------------------------------------

function errorResponse(res, statusCode, error) {
  const message =
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : error.message;
  return res.status(statusCode).json({ success: false, error: message });
}

// ---------------------------------------------------------------------------
// Initialize services
// ---------------------------------------------------------------------------

const licitacionesService = new LicitacionesService();

// ---------------------------------------------------------------------------
// Health check (no auth required — excluded in middleware.js)
// ---------------------------------------------------------------------------

app.get('/api/health', async (_req, res) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(503).json({ status: 'degraded', reason: 'Missing Supabase config' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error } = await supabase.from('processed_emails').select('id').limit(1);

    if (error) {
      return res.status(503).json({ status: 'degraded', reason: 'Supabase unreachable' });
    }

    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', reason: 'Health check failed' });
  }
});

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

/**
 * GET /api/licitaciones
 */
app.get('/api/licitaciones', async (req, res) => {
  try {
    const visitLocationQuery = req.query.visitLocation;
    const visitLocationFilter = Array.isArray(visitLocationQuery)
      ? visitLocationQuery
      : visitLocationQuery
      ? String(visitLocationQuery).split(',')
      : [];

    const townQuery = req.query.town;
    const townFilter = Array.isArray(townQuery)
      ? townQuery
      : townQuery
      ? String(townQuery).split(',')
      : [];

    const filters = {
      status: req.query.status,
      category: req.query.category,
      priority: req.query.priority,
      visitLocation: visitLocationFilter.filter(Boolean),
      town: townFilter.filter(Boolean),
      dateRange: req.query.dateRange,
      interested: req.query.interested,
    };

    if (!filters.visitLocation?.length) {
      delete filters.visitLocation;
    }

    if (!filters.town?.length) {
      delete filters.town;
    }

    const licitaciones = await licitacionesService.getAllLicitaciones(filters);
    res.json({ success: true, data: licitaciones });
  } catch (error) {
    console.error('Error fetching licitaciones:', error);
    errorResponse(res, 500, error);
  }
});

/**
 * GET /api/licitaciones/:id
 */
app.get('/api/licitaciones/:id', validateId, handleValidationErrors, async (req, res) => {
  try {
    const licitacion = await licitacionesService.getLicitacionById(req.params.id);
    res.json({ success: true, data: licitacion });
  } catch (error) {
    console.error(`Error fetching licitación ${req.params.id}:`, error);
    errorResponse(res, 500, error);
  }
});

/**
 * PATCH /api/licitaciones/:id/approve
 */
app.patch(
  '/api/licitaciones/:id/approve',
  [...validateId, ...validateNotes],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { notes } = req.body;
      const licitacion = await licitacionesService.updateApprovalStatus(
        req.params.id,
        'approved',
        notes
      );
      res.json({ success: true, data: licitacion });
    } catch (error) {
      console.error(`Error approving licitación ${req.params.id}:`, error);
      errorResponse(res, 500, error);
    }
  }
);

/**
 * PATCH /api/licitaciones/:id/reject
 */
app.patch(
  '/api/licitaciones/:id/reject',
  [...validateId, ...validateNotes],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { notes } = req.body;
      const licitacion = await licitacionesService.updateApprovalStatus(
        req.params.id,
        'rejected',
        notes
      );
      res.json({ success: true, data: licitacion });
    } catch (error) {
      console.error(`Error rejecting licitación ${req.params.id}:`, error);
      errorResponse(res, 500, error);
    }
  }
);

/**
 * DELETE /api/licitaciones/:id
 */
app.delete('/api/licitaciones/:id', validateId, handleValidationErrors, async (req, res) => {
  try {
    const result = await licitacionesService.deleteLicitacion(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error(`Error deleting licitación ${req.params.id}:`, error);
    errorResponse(res, 500, error);
  }
});

/**
 * PATCH /api/licitaciones/:id/pending
 */
app.patch(
  '/api/licitaciones/:id/pending',
  [...validateId, ...validateNotes],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { notes } = req.body;
      const licitacion = await licitacionesService.updateApprovalStatus(
        req.params.id,
        'pending',
        notes
      );
      res.json({ success: true, data: licitacion });
    } catch (error) {
      console.error(`Error resetting licitación ${req.params.id}:`, error);
      errorResponse(res, 500, error);
    }
  }
);

/**
 * GET /api/stats
 */
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await licitacionesService.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching stats:', error);
    errorResponse(res, 500, error);
  }
});

/**
 * GET /api/visits
 */
app.get('/api/visits', async (req, res) => {
  try {
    const visitLocationQuery = req.query.visitLocation;
    const visitLocationFilter = Array.isArray(visitLocationQuery)
      ? visitLocationQuery
      : visitLocationQuery
      ? String(visitLocationQuery).split(',')
      : [];

    const townQuery = req.query.town;
    const townFilter = Array.isArray(townQuery)
      ? townQuery
      : townQuery
      ? String(townQuery).split(',')
      : [];

    const filters = {
      status: req.query.status,
      category: req.query.category,
      priority: req.query.priority,
      visitLocation: visitLocationFilter.filter(Boolean),
      town: townFilter.filter(Boolean),
      dateRange: req.query.dateRange,
    };

    if (!filters.visitLocation?.length) {
      delete filters.visitLocation;
    }

    if (!filters.town?.length) {
      delete filters.town;
    }

    const visits = await licitacionesService.getSiteVisitEvents(filters);
    res.json({ success: true, data: visits });
  } catch (error) {
    console.error('Error fetching site visit events:', error);
    errorResponse(res, 500, error);
  }
});

// ---------------------------------------------------------------------------
// Cron endpoint — Vercel Cron Job triggers this daily
// ---------------------------------------------------------------------------

app.get('/api/cron/process-emails', async (req, res) => {
  // Verify CRON_SECRET (Vercel sends it as Authorization: Bearer <token>)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
  }

  try {
    // Dynamic import — only load the heavy agent when cron fires
    const { LicitacionAgent } = await import('../src/index.js');
    const agent = new LicitacionAgent();
    await agent.runOnce();

    res.json({
      success: true,
      message: 'Email processing completed',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron job error:', error);
    errorResponse(res, 500, error);
  }
});

// Serve index.html for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Export for Vercel serverless
export default app;
