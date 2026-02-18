const express = require("express");

function createAuditRoutes(auditManager) {
  const router = express.Router();

  // GET /api/audit/summary — Audit stats
  router.get("/summary", (req, res) => {
    try {
      const startDate = req.query.start;
      const endDate = req.query.end;
      res.json(auditManager.getSummary(startDate, endDate));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/audit/events — Audit log with filters
  router.get("/events", (req, res) => {
    try {
      const filters = {
        event_type: req.query.type,
        severity: req.query.severity,
        user_id: req.query.user_id,
        requires_review: req.query.requires_review === "true",
        since: req.query.since,
        limit: parseInt(req.query.limit, 10) || 100,
        offset: parseInt(req.query.offset, 10) || 0,
      };
      res.json(auditManager.listEvents(filters));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/audit/events — Log an audit event
  router.post("/events", (req, res) => {
    try {
      const { event_type, severity, action, details } = req.body;
      if (!event_type || !action) {
        return res.status(400).json({ error: "event_type and action required" });
      }
      // Use authenticated user identity, not request body
      const userId = req.user?.id || "system";
      const id = auditManager.logEvent(event_type, severity, userId, action, details);
      res.status(201).json({ id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/audit/events/:id/review — Mark as reviewed
  router.post("/events/:id/review", (req, res) => {
    try {
      // Use authenticated user identity
      const reviewerId = req.user?.id || req.body.reviewer_id;
      if (!reviewerId) {
        return res.status(400).json({ error: "Authentication required to review events" });
      }
      res.json(auditManager.markReviewed(req.params.id, reviewerId));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createAuditRoutes };
