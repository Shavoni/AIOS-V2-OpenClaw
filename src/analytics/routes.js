const express = require("express");

function createAnalyticsRoutes(analyticsManager) {
  const router = express.Router();

  // GET /api/analytics/summary — 30d aggregated metrics
  router.get("/summary", (req, res) => {
    try {
      const days = parseInt(req.query.days, 10) || 30;
      res.json(analyticsManager.getSummary(days));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/analytics/events — Paginated event list
  router.get("/events", (req, res) => {
    try {
      const filters = {
        agent_id: req.query.agent_id,
        user_id: req.query.user_id,
        since: req.query.since,
        hitl_mode: req.query.hitl_mode,
        limit: parseInt(req.query.limit, 10) || 100,
        offset: parseInt(req.query.offset, 10) || 0,
      };
      res.json(analyticsManager.getEvents(filters));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/analytics/agents/:id — Per-agent metrics
  router.get("/agents/:id", (req, res) => {
    try {
      const days = parseInt(req.query.days, 10) || 30;
      res.json(analyticsManager.getAgentMetrics(req.params.id, days));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/analytics/top-agents — Top 5 agents by query count
  router.get("/top-agents", (req, res) => {
    try {
      const days = parseInt(req.query.days, 10) || 30;
      const summary = analyticsManager.getSummary(days);
      const byAgent = summary.byAgent || {};
      const sorted = Object.entries(byAgent)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => (b.queries || 0) - (a.queries || 0))
        .slice(0, parseInt(req.query.limit, 10) || 5);
      res.json(sorted);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/analytics/top-departments — Top 5 departments
  router.get("/top-departments", (req, res) => {
    try {
      const days = parseInt(req.query.days, 10) || 30;
      const summary = analyticsManager.getSummary(days);
      const byDept = summary.byDepartment || {};
      const sorted = Object.entries(byDept)
        .map(([name, count]) => ({ name, queries: typeof count === 'number' ? count : count.queries || 0 }))
        .sort((a, b) => b.queries - a.queries)
        .slice(0, parseInt(req.query.limit, 10) || 5);
      res.json(sorted);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/analytics/hourly-distribution — 24h query distribution
  router.get("/hourly-distribution", (req, res) => {
    try {
      const days = parseInt(req.query.days, 10) || 30;
      const events = analyticsManager.getEvents({ limit: 10000 });
      const since = new Date();
      since.setDate(since.getDate() - days);

      const hourly = Array.from({ length: 24 }, (_, i) => ({ hour: i, label: `${i}:00`, count: 0 }));
      (Array.isArray(events) ? events : []).forEach(e => {
        if (!e.timestamp) return;
        const ts = new Date(e.timestamp);
        if (ts >= since) {
          hourly[ts.getHours()].count++;
        }
      });
      res.json(hourly);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/analytics/export — CSV or JSON export
  router.get("/export", (req, res) => {
    try {
      const format = req.query.format || "json";
      const days = parseInt(req.query.days, 10) || 30;

      if (format === "csv") {
        const csv = analyticsManager.exportCSV(days);
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=analytics.csv");
        return res.send(csv);
      }

      res.json(analyticsManager.exportJSON(days));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createAnalyticsRoutes };
