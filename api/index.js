import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import LicitacionesService from '../src/services/licitaciones.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Initialize services
const licitacionesService = new LicitacionesService();

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
    console.error('Error fetching licitaciones:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/licitaciones/:id
 * Get a single licitación by ID
 */
app.get('/api/licitaciones/:id', async (req, res) => {
  try {
    const licitacion = await licitacionesService.getLicitacionById(req.params.id);
    res.json({ success: true, data: licitacion });
  } catch (error) {
    console.error(`Error fetching licitación ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/licitaciones/:id/approve
 * Approve a licitación
 */
app.patch('/api/licitaciones/:id/approve', async (req, res) => {
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
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/licitaciones/:id/reject
 * Reject a licitación (marks as rejected, does not delete)
 */
app.patch('/api/licitaciones/:id/reject', async (req, res) => {
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
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/licitaciones/:id
 * Delete a licitación permanently
 */
app.delete('/api/licitaciones/:id', async (req, res) => {
  try {
    const result = await licitacionesService.deleteLicitacion(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error(`Error deleting licitación ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/licitaciones/:id/pending
 * Reset a licitación to pending
 */
app.patch('/api/licitaciones/:id/pending', async (req, res) => {
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
    console.error('Error fetching stats:', error);
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
    console.error('Error fetching site visit events:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Serve index.html for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Export for Vercel serverless
export default app;

