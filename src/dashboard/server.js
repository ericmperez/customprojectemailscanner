import express from 'express';
import cors from 'cors';
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

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize services
const licitacionesService = new LicitacionesService();

// Validate that :id parameter is a positive integer
function validateId(req, res) {
  const id = req.params.id;
  if (!id || isNaN(Number(id)) || Number(id) <= 0 || !Number.isInteger(Number(id))) {
    res.status(400).json({ success: false, error: 'Invalid ID parameter. Must be a positive integer.' });
    return null;
  }
  return Number(id);
}

// API Routes

/**
 * GET /api/licitaciones
 * Get all licitaciones with optional filtering
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
    logger.error('Error fetching licitaciones:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/licitaciones/:id
 * Get a single licitación by ID
 */
app.get('/api/licitaciones/:id', async (req, res) => {
  try {
    const id = validateId(req, res);
    if (id === null) return;
    const licitacion = await licitacionesService.getLicitacionById(id);
    res.json({ success: true, data: licitacion });
  } catch (error) {
    logger.error(`Error fetching licitación ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/licitaciones/:id/approve
 * Approve a licitación
 */
app.patch('/api/licitaciones/:id/approve', async (req, res) => {
  try {
    const id = validateId(req, res);
    if (id === null) return;
    const { notes } = req.body;
    const licitacion = await licitacionesService.updateApprovalStatus(
      id,
      'approved',
      notes
    );
    res.json({ success: true, data: licitacion });
  } catch (error) {
    logger.error(`Error approving licitación ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/licitaciones/:id/reject
 * Reject a licitación (marks as rejected, does not delete)
 */
app.patch('/api/licitaciones/:id/reject', async (req, res) => {
  try {
    const id = validateId(req, res);
    if (id === null) return;
    const { notes } = req.body;
    const licitacion = await licitacionesService.updateApprovalStatus(
      id,
      'rejected',
      notes
    );
    res.json({ success: true, data: licitacion });
  } catch (error) {
    logger.error(`Error rejecting licitación ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/licitaciones/:id
 * Delete a licitación permanently
 */
app.delete('/api/licitaciones/:id', async (req, res) => {
  try {
    const id = validateId(req, res);
    if (id === null) return;
    const result = await licitacionesService.deleteLicitacion(id);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error(`Error deleting licitación ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/licitaciones/:id/pending
 * Reset a licitación to pending
 */
app.patch('/api/licitaciones/:id/pending', async (req, res) => {
  try {
    const id = validateId(req, res);
    if (id === null) return;
    const { notes } = req.body;
    const licitacion = await licitacionesService.updateApprovalStatus(
      id,
      'pending',
      notes
    );
    res.json({ success: true, data: licitacion });
  } catch (error) {
    logger.error(`Error resetting licitación ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/stats
 * Get dashboard statistics
 */
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await licitacionesService.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/visits
 * Get licitaciones that require a site visit, optionally filtered
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
    logger.error('Error fetching site visit events:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Serve index.html for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  logger.info(`Dashboard server running on http://localhost:${PORT}`);
  console.log(`\n🎯 Dashboard running at: http://localhost:${PORT}`);
  console.log(`📊 API available at: http://localhost:${PORT}/api`);
});

export default app;



