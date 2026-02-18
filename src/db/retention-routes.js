const express = require('express');
const { RetentionService } = require('./retention-service');

function createRetentionRoutes(db, markDirty) {
  const router = express.Router();
  const retention = new RetentionService(db, markDirty);

  // GET /retention — retrieve current retention policy
  router.get('/retention', (_req, res) => {
    try {
      res.json(retention.getPolicy());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /retention — update retention policy
  router.put('/retention', (req, res) => {
    try {
      retention.updatePolicy(req.body);
      res.json(retention.getPolicy());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /retention/purge — execute purge based on current policy
  router.post('/retention/purge', (_req, res) => {
    try {
      const result = retention.purge();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createRetentionRoutes };
