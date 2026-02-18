require('dotenv').config();
const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createApp } = require('./src');

const PORT = process.env.PORT || 3000;

async function main() {
  const app = express();

  // Middleware
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(morgan('dev'));
  app.use(express.json());

  // Initialize AIOS
  const aios = await createApp();

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      name: 'AIOS V2',
      agent: aios.agent.identity.name,
      version: '0.1.0',
      uptime: process.uptime(),
      skills: aios.skills.getSkillCount(),
      providers: aios.router.getProviderStatus().length,
    });
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
  process.on('SIGINT', aios.shutdown);
  process.on('SIGTERM', aios.shutdown);

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`\n  AIOS V2 — ${aios.agent.identity.getSummary()}`);
    console.log(`  Server:   http://127.0.0.1:${PORT}`);
    console.log(`  Skills:   ${aios.skills.getSkillCount()} loaded`);
    console.log(`  Providers: ${aios.router.getProviderStatus().length} configured\n`);
  });
}

main().catch((err) => {
  console.error('Failed to start AIOS V2:', err);
  process.exit(1);
});
