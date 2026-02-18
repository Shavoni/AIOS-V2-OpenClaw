/**
 * Research Pipeline Routes — REST API for deep research jobs.
 */

const { Router } = require("express");
const rateLimit = require("express-rate-limit");
const { validate } = require("../middleware/validation");

const researchJobSchema = {
  query: { required: true, type: "string", minLength: 1, maxLength: 10000 },
  ttl: { type: "number" },
  metadata: { type: "object" },
};

// Rate limit: 10 job submissions per user per 15 minutes
const jobSubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: "Too many research jobs submitted. Try again later." },
});

function createResearchRoutes(queueService, manager) {
  const router = Router();

  // POST /jobs — Submit a new research job
  router.post("/jobs", jobSubmitLimiter, validate(researchJobSchema), async (req, res) => {
    try {
      // Clamp TTL: minimum 60s, maximum 7 days (604800s), default 24h
      const rawTtl = req.body.ttl;
      const ttl = rawTtl != null ? Math.max(60, Math.min(604800, rawTtl)) : undefined;

      const job = await queueService.submitJob({
        userId: req.user.id,
        query: req.body.query,
        ttl,
        metadata: req.body.metadata,
      });
      res.status(201).json(job);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /jobs — List research jobs for current user
  router.get("/jobs", (req, res) => {
    try {
      const jobs = manager.listJobs({
        userId: req.user.id,
        status: req.query.status,
        limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
      });
      res.json(jobs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /jobs/:id — Get a specific research job
  router.get("/jobs/:id", (req, res) => {
    try {
      const job = manager.getJob(req.params.id);
      if (!job) return res.status(404).json({ error: "Job not found" });
      res.json(job);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /jobs/:id/result — Get synthesis result for a job
  router.get("/jobs/:id/result", (req, res) => {
    try {
      const job = manager.getJob(req.params.id);
      if (!job) return res.status(404).json({ error: "Job not found" });

      const result = manager.getResult(req.params.id);
      if (!result) return res.status(404).json({ error: "Result not available" });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /jobs/:id/sources — Get scored sources for a job
  router.get("/jobs/:id/sources", (req, res) => {
    try {
      const job = manager.getJob(req.params.id);
      if (!job) return res.status(404).json({ error: "Job not found" });

      const sources = manager.getSourcesForJob(req.params.id);
      res.json(sources);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /jobs/:id/cancel — Cancel a research job
  router.post("/jobs/:id/cancel", async (req, res) => {
    try {
      const cancelled = await queueService.cancelJob(req.params.id);
      if (!cancelled) {
        return res.status(409).json({ error: "Job cannot be cancelled" });
      }
      res.json({ message: "Job cancelled", jobId: req.params.id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /queue/summary — Get queue statistics
  router.get("/queue/summary", (_req, res) => {
    try {
      const summary = queueService.getQueueSummary();
      res.json(summary);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createResearchRoutes };
