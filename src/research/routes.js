/**
 * Research Pipeline Routes — REST API for deep research jobs.
 */

const { Router } = require("express");
const rateLimit = require("express-rate-limit");
const { validate } = require("../middleware/validation");
const { asyncHandler } = require("../middleware/async-handler");

const researchJobSchema = {
  query: { required: true, type: "string", minLength: 1, maxLength: 10000 },
  ttl: { type: "number" },
  metadata: { type: "object" },
};

const jobSubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: "Too many research jobs submitted. Try again later." },
});

function createResearchRoutes(queueService, manager) {
  const router = Router();

  /** Lookup job or 404 */
  function getJobOr404(req, res) {
    const job = manager.getJob(req.params.id);
    if (!job) { res.status(404).json({ error: "Job not found" }); return null; }
    return job;
  }

  router.post("/jobs", jobSubmitLimiter, validate(researchJobSchema), asyncHandler(async (req, res) => {
    const rawTtl = req.body.ttl;
    const ttl = rawTtl != null ? Math.max(60, Math.min(604800, rawTtl)) : undefined;
    const job = await queueService.submitJob({
      userId: req.user.id,
      query: req.body.query,
      ttl,
      metadata: req.body.metadata,
    });
    res.status(201).json(job);
  }));

  router.get("/jobs", asyncHandler((req, res) => {
    const jobs = manager.listJobs({
      userId: req.user.id,
      status: req.query.status,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
    });
    res.json(jobs);
  }));

  router.get("/jobs/:id", asyncHandler((req, res) => {
    const job = getJobOr404(req, res);
    if (!job) return;
    res.json(job);
  }));

  router.get("/jobs/:id/result", asyncHandler((req, res) => {
    const job = getJobOr404(req, res);
    if (!job) return;
    const result = manager.getResult(req.params.id);
    if (!result) return res.status(404).json({ error: "Result not available" });
    res.json(result);
  }));

  router.get("/jobs/:id/sources", asyncHandler((req, res) => {
    const job = getJobOr404(req, res);
    if (!job) return;
    res.json(manager.getSourcesForJob(req.params.id));
  }));

  router.post("/jobs/:id/cancel", asyncHandler(async (req, res) => {
    const cancelled = await queueService.cancelJob(req.params.id);
    if (!cancelled) return res.status(409).json({ error: "Job cannot be cancelled" });
    res.json({ message: "Job cancelled", jobId: req.params.id });
  }));

  router.get("/queue/summary", asyncHandler((_req, res) => {
    res.json(queueService.getQueueSummary());
  }));

  return router;
}

module.exports = { createResearchRoutes };
