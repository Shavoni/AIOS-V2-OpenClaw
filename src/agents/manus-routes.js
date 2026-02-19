/**
 * MANUS Routes — API endpoints for MANUS research automation.
 *
 * POST /research      — Submit prompt → create MANUS task → poll → auto-ingest
 * GET  /tasks         — List MANUS tasks
 * GET  /tasks/:id     — Get task status + output
 * POST /ingest-session — Scan MANUS directory → provision agents
 */

const express = require("express");
const { ManusAPIClient } = require("./manus-api-client");

function createManusRoutes({ manusIngest, sessionIngest, agentManager, rag, eventBus }) {
  const router = express.Router();

  // Lazy-init MANUS API client (only if key is configured)
  let manusClient = null;
  function getClient() {
    if (!manusClient) {
      const apiKey = process.env.MANUS_API_KEY;
      if (!apiKey) throw new Error("MANUS_API_KEY not configured");
      manusClient = new ManusAPIClient({ apiKey });
    }
    return manusClient;
  }

  // POST /manus/research — Submit a research prompt to MANUS
  router.post("/research", async (req, res) => {
    try {
      const { prompt, agentId, agentProfile, taskMode } = req.body;
      if (!prompt) return res.status(400).json({ error: "prompt is required" });

      const client = getClient();

      // Create MANUS task
      const created = await client.createTask({
        prompt,
        agentProfile: agentProfile || "manus-1.6",
        taskMode: taskMode || "agent",
      });

      // Fire-and-forget: poll in background and auto-ingest when done
      _pollAndIngest(client, created.task_id, agentId, { manusIngest, agentManager, rag, eventBus }).catch(() => {});

      res.status(202).json({
        ok: true,
        task_id: created.task_id,
        task_title: created.task_title,
        task_url: created.task_url,
        status: "submitted",
        message: "Research task submitted. Results will auto-ingest when complete.",
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /manus/tasks — List MANUS tasks
  router.get("/tasks", async (req, res) => {
    try {
      const client = getClient();
      const { limit, order, status } = req.query;
      const opts = {};
      if (limit) opts.limit = parseInt(limit, 10);
      if (order) opts.order = order;
      if (status) opts.status = Array.isArray(status) ? status : [status];

      const result = await client.listTasks(opts);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /manus/tasks/:id — Get single task with output
  router.get("/tasks/:id", async (req, res) => {
    try {
      const client = getClient();
      const task = await client.getTask(req.params.id);
      const output = client.extractOutput(task);
      res.json({ ...task, extractedOutput: output });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /manus/ingest-session — Scan a MANUS output directory and provision agents
  router.post("/ingest-session", async (req, res) => {
    try {
      if (!sessionIngest) return res.status(501).json({ error: "Session ingest not configured" });

      const { directoryPath } = req.body;
      if (!directoryPath) return res.status(400).json({ error: "directoryPath is required" });

      // Validate directory exists
      const fs = require("fs");
      if (!fs.existsSync(directoryPath)) {
        return res.status(400).json({ error: `Directory not found: ${directoryPath}` });
      }

      const result = await sessionIngest.ingestSession(directoryPath);
      res.json({
        ok: true,
        ...result,
        message: `Provisioned ${result.agentsCreated} agents with ${result.totalKBEntriesCreated} KB entries`,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /manus/ingest-session/preview — Preview what would be ingested (dry run)
  router.post("/ingest-session/preview", async (req, res) => {
    try {
      if (!sessionIngest) return res.status(501).json({ error: "Session ingest not configured" });

      const { directoryPath } = req.body;
      if (!directoryPath) return res.status(400).json({ error: "directoryPath is required" });

      const fs = require("fs");
      if (!fs.existsSync(directoryPath)) {
        return res.status(400).json({ error: `Directory not found: ${directoryPath}` });
      }

      const manifest = await sessionIngest.parseManifest(directoryPath);
      res.json({ ok: true, ...manifest });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /manus/status — Check if MANUS API is configured and reachable
  router.get("/status", async (_req, res) => {
    try {
      const client = getClient();
      const result = await client.listTasks({ limit: 1 });
      res.json({ configured: true, reachable: true, tasks: result.data.length });
    } catch (err) {
      res.json({ configured: !!process.env.MANUS_API_KEY, reachable: false, error: err.message });
    }
  });

  return router;
}

/**
 * Background worker: poll a MANUS task and auto-ingest output into agent KB.
 * @private
 */
async function _pollAndIngest(client, taskId, agentId, deps) {
  try {
    const task = await client.pollTask(taskId, {
      intervalMs: 10000,
      timeoutMs: 600000, // 10 min max
    });

    if (task.status !== "completed") return;

    const { texts, files } = client.extractOutput(task);

    // Ingest text outputs as KB documents
    if (deps.manusIngest && agentId) {
      for (let i = 0; i < texts.length; i++) {
        await deps.manusIngest.ingestFile(agentId, {
          filename: `manus-research-${taskId}-${i}.md`,
          file_type: "md",
          content: texts[i],
          manus_job_id: taskId,
          priority: 80,
        });
      }
    }

    // Emit event for any listeners
    if (deps.eventBus) {
      deps.eventBus.emit("manus:completed", {
        taskId,
        agentId,
        textsIngested: texts.length,
        filesFound: files.length,
      });
    }
  } catch {
    // Non-critical — don't crash the server
  }
}

module.exports = { createManusRoutes };
