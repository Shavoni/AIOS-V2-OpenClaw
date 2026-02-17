/**
 * @file server.js
 * @description AIOS V2 API server entry point.
 * Configures Express middleware, connects to MongoDB, and starts the HTTP server.
 */

const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/aios-v2')
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

/**
 * @route GET /health
 * @description Health check endpoint
 * @returns {object} { status: 'ok', message: string }
 */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'AIOS V2 is running' });
});

/**
 * @route GET /api/metrics
 * @description System performance metrics
 * @returns {object} { cpu, memory, uptime }
 */
app.get('/api/metrics', (_req, res) => {
  res.json({
    cpu: process.cpuUsage(),
    memory: process.memoryUsage(),
    uptime: process.uptime()
  });
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`AIOS V2 server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
