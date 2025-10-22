// ===== FILE: src/server.js (UPDATED) =====

const express = require('express');
const cors = require('cors');
require('dotenv').config();
const logger = require('./config/logger');
const db = require('./database/db');
const rag = require('./services/rag');

// Import routes
const uploadRoutes = require('./routes/upload');
const evaluateRoutes = require('./routes/evaluate');
const resultRoutes = require('./routes/result');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// ===== INITIALIZE SYSTEMS =====
async function initializeSystems() {
  try {
    // Initialize database
    logger.info('Initializing database...');
    await db.init();
    logger.info('✅ Database initialized');

    // Initialize RAG (ChromaDB)
    logger.info('Initializing RAG system...');
    await rag.initializeChromaDB();
    logger.info('✅ ChromaDB initialized');

    // Ingest reference documents
    logger.info('Ingesting reference documents...');
    await rag.ingestReferenceDocuments();
    logger.info('✅ Reference documents ingested');

  } catch (error) {
    logger.error('System initialization error:', error);
    throw error;
  }
}

// ===== REGISTER ROUTES =====
app.use('/api/upload', uploadRoutes);
app.use('/api/evaluate', evaluateRoutes);
app.use('/api/result', resultRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date(),
    environment: process.env.NODE_ENV,
    services: {
      database: 'connected',
      rag: 'initialized'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Error:', err);
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    error: {
      message,
      statusCode,
      timestamp: new Date()
    }
  });
});

// ===== START SERVER =====
async function start() {
  try {
    await initializeSystems();
    
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on http://localhost:${PORT}`);
      logger.info('📦 Database connected');
      logger.info('🔍 RAG system active');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

module.exports = app;