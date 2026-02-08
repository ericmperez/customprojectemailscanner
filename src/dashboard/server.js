import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { param, body, validationResult } from 'express-validator';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import LicitacionesService from '../services/licitaciones.service.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.DASHBOARD_PORT || 4000;

// ---------------------------------------------------------------------------
// Security middleware
// ---------------------------------------------------------------------------

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

const allowedOrigins = (() => {
  const envOrigins = process.env.ALLOWED_ORIGINS;
  if (envOrigins) {
    return envOrigins.split(',').map((o) => o.trim()).filter(Boolean);
  }
  return ['http://localhost:3000', 'http://localhost:4000'];
})();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
  })
);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
// API Routes
// ---------------------------------------------------------------------------

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
    logger.error('Error fetching licitaciones:', error);
    errorResponse(res, 500, error);
  }
});

app.get('/api/licitaciones/:id', validateId, handleValidationErrors, async (req, res) => {
  try {
    const licitacion = await licitacionesService.getLicitacionById(req.params.id);
    res.json({ success: true, data: licitacion });
  } catch (error) {
    logger.error(`Error fetching licitación ${req.params.id}:`, error);
    errorResponse(res, 500, error);
  }
});

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
      logger.error(`Error approving licitación ${req.params.id}:`, error);
      errorResponse(res, 500, error);
    }
  }
);

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
      logger.error(`Error rejecting licitación ${req.params.id}:`, error);
      errorResponse(res, 500, error);
    }
  }
);

app.delete('/api/licitaciones/:id', validateId, handleValidationErrors, async (req, res) => {
  try {
    const result = await licitacionesService.deleteLicitacion(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error(`Error deleting licitación ${req.params.id}:`, error);
    errorResponse(res, 500, error);
  }
});

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
      logger.error(`Error resetting licitación ${req.params.id}:`, error);
      errorResponse(res, 500, error);
    }
  }
);

app.get('/api/stats', async (req, res) => {
  try {
    const stats = await licitacionesService.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Error fetching stats:', error);
    errorResponse(res, 500, error);
  }
});

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
    logger.error('Error fetching site visit events:', error);
    errorResponse(res, 500, error);
  }
});

// Serve index.html for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  logger.info(`Dashboard server running on http://localhost:${PORT}`);
  console.log(`\n Dashboard running at: http://localhost:${PORT}`);
  console.log(` API available at: http://localhost:${PORT}/api`);
});

export default app;
