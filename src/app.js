/**
 * @file src/app.js
 * @description Express app factory for AIOS V2.
 * Use this module when importing the app without starting the server
 * (e.g., in tests or as a sub-app).
 */

const express = require('express');

/**
 * Creates and configures an Express application.
 * @returns {express.Application} Configured Express app
 */
function createApp() {
  const app = express();

  app.use(express.json());

  app.get('/', (_req, res) => {
    res.json({ name: 'AIOS V2', status: 'running' });
  });

  return app;
}

module.exports = createApp;
