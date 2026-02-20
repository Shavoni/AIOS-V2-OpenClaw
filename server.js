require('dotenv').config();
const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createApp } = require('./src');
const { validateEnv } = require('./src/config/env-validator');
const { apiLimiter, chatLimiter, authLimiter, heavyLimiter } = require('./src/middleware/rate-limit');

const PORT = process.env.PORT || 3000;

async function main() {
  // Validate environment variables
  validateEnv();

  const app = express();

  // Middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'", "ws:", "wss:"],
        imgSrc: ["'self'", "data:", "blob:"],
        fontSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));
  app.use(cors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
      : true,  // Allow all origins in development
    credentials: true,
  }));
  app.use(morgan('dev'));
  app.use(express.json({ limit: '10mb' }));

  // Rate limiting
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  app.use('/api/chat', chatLimiter);
  app.use('/api/analytics/export', heavyLimiter);
  app.use('/api/analytics/reports', heavyLimiter);
  app.use('/api', apiLimiter);

  // Initialize AIOS
  const aios = await createApp();

  // Health check (enhanced: verifies DB connectivity)
  app.get('/health', (_req, res) => {
    let dbOk = false;
    try {
      // Verify DB is responsive
      const result = aios.memory.store.db.exec("SELECT 1");
      dbOk = result.length > 0;
    } catch {
      dbOk = false;
    }

    const status = dbOk ? 'healthy' : 'degraded';
    const httpStatus = dbOk ? 200 : 503;

    res.status(httpStatus).json({
      status,
      name: 'AIOS V2',
      agent: aios.agent.identity.name,
      version: '2.0.0',
      uptime: process.uptime(),
      skills: aios.skills.getSkillCount(),
      providers: aios.router.getProviderStatus().length,
      database: dbOk ? 'connected' : 'error',
      memory: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heap: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
    });
  });

  // Health alias — frontend polls /api/health
  app.get('/api/health', (req, res) => {
    res.redirect(307, '/health');
  });

  // API routes
  app.use('/api', aios.apiRoutes);

  // Serve frontend
  app.use(express.static(path.join(__dirname, 'public')));

  // SPA fallback
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  // Create HTTP server + Socket.io
  const server = http.createServer(app);
  const io = aios.setupSocket(server);

  // Graceful shutdown
  const shutdown = () => {
    console.log('\nGraceful shutdown initiated...');
    server.close(() => {
      console.log('HTTP server closed');
      aios.shutdown();
    });
    // Force close after 10 seconds
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  const HOST = process.env.HOST || '0.0.0.0';
  server.listen(PORT, HOST, () => {
    console.log(`\n  AIOS V2 — ${aios.agent.identity.getSummary()}`);
    console.log(`  Server:    http://${HOST}:${PORT}`);
    console.log(`  Skills:    ${aios.skills.getSkillCount()} loaded`);
    console.log(`  Providers: ${aios.router.getProviderStatus().length} configured`);
    console.log(`  Pages:     11 (Dashboard, Chat, Agents, Skills, Memory, Models, Approvals, Metrics, Audit, Settings, Onboarding)`);
    console.log(`  APIs:      auth, chat, agents, hitl, analytics, audit, governance, system, templates, onboarding`);
    console.log(`  Features:  JWT auth, rate limiting, auto-save, RAG pipeline, real-time WebSocket\n`);
  });
}

main().catch((err) => {
  console.error('Failed to start AIOS V2:', err);
  process.exit(1);
});
