const express = require("express");

function createHITLRoutes(hitlManager) {
  const router = express.Router();

  // GET /api/hitl/queue/summary — Queue summary stats
  router.get("/queue/summary", (_req, res) => {
    try {
      res.json(hitlManager.getQueueSummary());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/hitl/queue — Pending approvals
  router.get("/queue", (req, res) => {
    try {
      const filters = {
        hitl_mode: req.query.mode,
        agent_id: req.query.agent_id,
        priority: req.query.priority,
        limit: parseInt(req.query.limit, 10) || 50,
      };
      res.json(hitlManager.listPending(filters));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/hitl/approvals — All approvals with filters
  router.get("/approvals", (req, res) => {
    try {
      const filters = {
        status: req.query.status,
        hitl_mode: req.query.mode,
        limit: parseInt(req.query.limit, 10) || 100,
      };
      res.json(hitlManager.listAll(filters));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/hitl/approvals — Create approval request
  router.post("/approvals", (req, res) => {
    try {
      const approval = hitlManager.createApproval(req.body);
      res.status(201).json(approval);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/hitl/approvals/:id — Get single approval
  router.get("/approvals/:id", (req, res) => {
    try {
      const approval = hitlManager.getApproval(req.params.id);
      if (!approval) return res.status(404).json({ error: "Approval not found" });
      res.json(approval);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/hitl/approvals/:id/approve — Approve request
  router.post("/approvals/:id/approve", (req, res) => {
    try {
      const { notes, modified_response } = req.body;
      // Use authenticated user, fall back to body for backwards compatibility
      const reviewerId = req.user?.id || req.body.reviewer_id || "unknown";
      const approval = hitlManager.approve(
        req.params.id,
        reviewerId,
        notes,
        modified_response
      );
      if (!approval) return res.status(404).json({ error: "Approval not found" });
      res.json(approval);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/hitl/approvals/:id/reject — Reject request
  router.post("/approvals/:id/reject", (req, res) => {
    try {
      const { reason } = req.body;
      const reviewerId = req.user?.id || req.body.reviewer_id || "unknown";
      const approval = hitlManager.reject(req.params.id, reviewerId, reason);
      if (!approval) return res.status(404).json({ error: "Approval not found" });
      res.json(approval);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── SLA Status ──────────────────────────────────────────

  // GET /api/hitl/sla/status — SLA monitoring for pending approvals
  router.get("/sla/status", (_req, res) => {
    try {
      const pending = hitlManager.listPending({ limit: 200 });
      const now = Date.now();

      const SLA_LIMITS = {
        urgent: 1 * 60 * 60 * 1000,   // 1 hour
        high: 4 * 60 * 60 * 1000,     // 4 hours
        normal: 24 * 60 * 60 * 1000,  // 24 hours
        low: 72 * 60 * 60 * 1000,     // 72 hours
      };

      const items = (Array.isArray(pending) ? pending : []).map(item => {
        const priority = (item.priority || 'normal').toLowerCase();
        const limit = SLA_LIMITS[priority] || SLA_LIMITS.normal;
        const created = new Date(item.created_at || item.timestamp || now).getTime();
        const elapsed = now - created;
        const remaining = limit - elapsed;
        const status = remaining <= 0 ? 'breached' : remaining < limit * 0.25 ? 'warning' : 'ok';

        return {
          id: item.id,
          priority,
          created_at: item.created_at || item.timestamp,
          sla_limit_ms: limit,
          elapsed_ms: elapsed,
          remaining_ms: Math.max(0, remaining),
          status,
        };
      });

      const breached = items.filter(i => i.status === 'breached').length;
      const warning = items.filter(i => i.status === 'warning').length;
      const ok = items.filter(i => i.status === 'ok').length;

      res.json({ total: items.length, breached, warning, ok, items });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Batch Operations ──────────────────────────────────

  // POST /api/hitl/batch/approve — Batch approve multiple items
  router.post("/batch/approve", (req, res) => {
    try {
      const { ids, notes } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "ids array required" });
      }
      const reviewerId = req.user?.id || req.body.reviewer_id || "admin";
      const results = ids.map(id => {
        try {
          return { id, result: hitlManager.approve(id, reviewerId, notes || 'Batch approved') };
        } catch (err) {
          return { id, error: err.message };
        }
      });
      const approved = results.filter(r => r.result).length;
      const failed = results.filter(r => r.error).length;
      res.json({ approved, failed, results });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/hitl/batch/reject — Batch reject multiple items
  router.post("/batch/reject", (req, res) => {
    try {
      const { ids, reason } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "ids array required" });
      }
      const reviewerId = req.user?.id || req.body.reviewer_id || "admin";
      const results = ids.map(id => {
        try {
          return { id, result: hitlManager.reject(id, reviewerId, reason || 'Batch rejected') };
        } catch (err) {
          return { id, error: err.message };
        }
      });
      const rejected = results.filter(r => r.result).length;
      const failed = results.filter(r => r.error).length;
      res.json({ rejected, failed, results });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createHITLRoutes };
