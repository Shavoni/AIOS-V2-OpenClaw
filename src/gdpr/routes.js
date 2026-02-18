const express = require('express');

function createGDPRRoutes(gdprService, consentService) {
  const router = express.Router();

  // GET /api/gdpr/export — Export authenticated user's own data
  router.get('/export', (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId || userId === 'anon') {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const data = gdprService.exportUserData(userId);
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/gdpr/erase — Erase authenticated user's data
  router.delete('/erase', (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId || userId === 'anon') {
        return res.status(401).json({ error: 'Authentication required' });
      }
      if (req.query.confirm !== 'true') {
        return res.status(400).json({ error: 'Confirmation required: add ?confirm=true' });
      }
      gdprService.eraseUserData(userId);
      res.json({ ok: true, message: 'All user data has been erased' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/gdpr/consents — List authenticated user's consents
  router.get('/consents', (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId || userId === 'anon') {
        return res.status(401).json({ error: 'Authentication required' });
      }
      res.json(consentService.getConsents(userId));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/gdpr/consents — Grant a consent
  router.post('/consents', (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId || userId === 'anon') {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const { consent_type } = req.body;
      if (!consent_type) {
        return res.status(400).json({ error: 'consent_type required' });
      }
      const record = consentService.grantConsent(userId, consent_type);
      res.status(201).json(record);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/gdpr/consents/:type — Revoke a consent
  router.delete('/consents/:type', (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId || userId === 'anon') {
        return res.status(401).json({ error: 'Authentication required' });
      }
      consentService.revokeConsent(userId, req.params.type);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/gdpr/privacy — Privacy notice
  router.get('/privacy', (_req, res) => {
    res.json({
      title: 'Privacy Notice',
      version: '1.0',
      data_collected: [
        'Chat messages and session history',
        'User account information (username, email, department)',
        'Analytics events (query patterns, response times)',
        'Audit trail (actions taken, governance decisions)',
      ],
      data_retention: 'Configurable per data type. See /api/system/retention for current policy.',
      your_rights: [
        'Right to Access: GET /api/gdpr/export',
        'Right to Erasure: DELETE /api/gdpr/erase?confirm=true',
        'Consent Management: GET/POST/DELETE /api/gdpr/consents',
      ],
    });
  });

  return router;
}

module.exports = { createGDPRRoutes };
