const express = require("express");
const fs = require("fs");
const path = require("path");
const { streamToSSE } = require("../router/stream");
const metricsService = require("../services/metrics-service");
const { validate, schemas } = require("../middleware/validation");

function createChatRoutes(handler, memory, skills, agent, router, config) {
  const api = express.Router();

  // POST /api/chat — Send message (non-streaming)
  api.post("/chat", async (req, res) => {
    try {
      const sessionId = req.body.sessionId || req.body.conversationId;
      const { message, profile, stream } = req.body;
      if (!sessionId || !message) {
        return res.status(400).json({ error: "sessionId and message required" });
      }

      // If client requests streaming via body flag, redirect to SSE
      if (stream) {
        const streamIter = handler.handleStream(sessionId, message, { profile });
        return streamToSSE(res, streamIter, { sessionId, profile });
      }

      const result = await handler.handle(sessionId, message, { profile });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/chat/stream — Send message (SSE)
  api.post("/chat/stream", async (req, res) => {
    try {
      const sessionId = req.body.sessionId || req.body.conversationId;
      const { message, profile } = req.body;
      if (!sessionId || !message) {
        return res.status(400).json({ error: "sessionId and message required" });
      }

      const stream = handler.handleStream(sessionId, message, { profile });
      streamToSSE(res, stream, { sessionId, profile });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/sessions — List sessions
  api.get("/sessions", (_req, res) => {
    try {
      const sessions = memory.listSessions(50);
      res.json(sessions);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/sessions — Create session
  api.post("/sessions", (req, res) => {
    try {
      const { title, profile } = req.body;
      const session = memory.createSession(title || "New Chat", profile || "main");
      res.status(201).json(session);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/sessions/:id/messages — Get messages
  api.get("/sessions/:id/messages", (req, res) => {
    try {
      const messages = memory.getMessages(req.params.id, 200);
      res.json(messages);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/sessions/:id — Delete session
  api.delete("/sessions/:id", (req, res) => {
    try {
      memory.deleteSession(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/agent — Agent info
  api.get("/agent", (_req, res) => {
    try {
      const info = agent.getAgentInfo();
      info.skillCount = skills.getSkillCount();
      res.json(info);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/providers — Provider status
  api.get("/providers", (_req, res) => {
    try {
      res.json(router.getProviderStatus());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/memory/files — List memory files
  api.get("/memory/files", async (_req, res) => {
    try {
      res.json(await memory.listMemoryFiles());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Route Aliases (frontend expects these) ─────────────

  // GET /api/chat/conversations → alias for GET /api/sessions
  api.get("/chat/conversations", (_req, res) => {
    try {
      const sessions = memory.listSessions(50);
      res.json(sessions);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/models → alias for GET /api/providers
  api.get("/models", (_req, res) => {
    try {
      res.json(router.getProviderStatus());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/memory → alias for GET /api/memory/files
  api.get("/memory", async (_req, res) => {
    try {
      res.json(await memory.listMemoryFiles());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/memory/search — Search through memory files
  api.get("/memory/search", async (req, res) => {
    try {
      const query = req.query.q || "";
      if (!query) return res.json([]);

      const files = await memory.listMemoryFiles();
      const results = [];
      const lowerQ = query.toLowerCase();

      for (const file of files) {
        const filePath = file.path || path.join(config.projectRoot, "memory", file.name);
        if (!fs.existsSync(filePath)) continue;
        const content = fs.readFileSync(filePath, "utf-8");
        const lines = content.split("\n");

        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(lowerQ)) {
            results.push({
              filename: file.name,
              line: i + 1,
              context: lines[i].trim().slice(0, 200),
            });
          }
        }
      }
      res.json(results.slice(0, 50));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/memory/:filename — Read file content
  api.get("/memory/:filename", (req, res) => {
    try {
      const filename = path.basename(req.params.filename);
      const memDir = path.resolve(config.projectRoot, "memory");
      const filePath = path.resolve(memDir, filename);

      // Prevent directory traversal (resolve handles Windows paths)
      if (!filePath.startsWith(memDir + path.sep) && filePath !== memDir) {
        return res.status(400).json({ error: "Invalid filename" });
      }

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
      }
      const content = fs.readFileSync(filePath, "utf-8");
      res.json({ filename, content });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/memory — Write file
  api.post("/memory", validate(schemas.writeMemory), async (req, res) => {
    try {
      const { filename, content } = req.body;
      if (!filename || content === undefined) {
        return res.status(400).json({ error: "filename and content required" });
      }
      await memory.fileMemory.writeMemoryFile(filename, content);
      res.json({ ok: true, filename });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/models/:name/test — Test provider connection
  api.post("/models/:name/test", async (req, res) => {
    try {
      const providerName = req.params.name;
      const client = router.clients?.find(
        (c) => c.name === providerName || c.id === providerName
      );

      if (client && typeof client.healthCheck === "function") {
        const result = await client.healthCheck();
        return res.json({ status: "ok", provider: providerName, ...result });
      }

      // Fallback: check provider status
      const statuses = router.getProviderStatus();
      const found = Array.isArray(statuses)
        ? statuses.find((s) => (s.name || s.provider || "").toLowerCase() === providerName.toLowerCase())
        : null;

      if (found) {
        return res.json({ status: "ok", provider: providerName, available: true });
      }

      res.json({ status: "error", provider: providerName, error: "Provider not found" });
    } catch (err) {
      res.json({ status: "error", provider: req.params.name, error: err.message });
    }
  });

  // GET /api/metrics — Aggregated metrics
  api.get("/metrics", (_req, res) => {
    try {
      const data = metricsService.getMetrics();
      res.json({
        totalRequests: data.models.totalRequests,
        totalCost: data.models.totalCost,
        errorRate: data.errors.total > 0
          ? ((data.errors.total / Math.max(data.requests.total, 1)) * 100).toFixed(1)
          : "0",
        avgLatency: data.chat.avgLatencyMs,
        byProvider: data.models.byProvider,
        requests: data.requests,
        timeline: [],
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/metrics/activity — Activity feed
  api.get("/metrics/activity", (req, res) => {
    try {
      const limit = parseInt(req.query.limit, 10) || 20;
      const activity = metricsService.getActivity(limit);
      res.json(activity);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/config — Safe config subset
  api.get("/config", (_req, res) => {
    try {
      const providerStatuses = router.getProviderStatus();
      const fallbackChain = config.fallbackChain || [];
      res.json({
        routing: {
          defaultProvider: "auto",
          fallbackChain,
          strategy: "cost-optimized",
        },
        providers: Array.isArray(providerStatuses)
          ? providerStatuses.map((p) => ({ name: p.name || p.provider, status: p.status }))
          : [],
        version: "2.0.0",
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Phase 7: Session Enhancements ─────────────────────

  // POST /api/sessions/conversations — Create with user_id, department
  api.post("/sessions/conversations", (req, res) => {
    try {
      const { title, profile, user_id, department } = req.body;
      const session = memory.createSession(title || "New Chat", profile || "main");
      // Store extended metadata (user_id, department) if supported
      res.status(201).json({ ...session, user_id, department });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/sessions/conversations/:id/context — Get context for LLM
  api.get("/sessions/conversations/:id/context", (req, res) => {
    try {
      const context = memory.buildContext(req.params.id, 8000);
      res.json({ sessionId: req.params.id, messages: context, tokenBudget: 8000 });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Sanitize userId to prevent path traversal
  function safeUserId(userId) {
    const safe = String(userId).replace(/[^a-zA-Z0-9_-]/g, "");
    if (!safe) throw new Error("Invalid user ID");
    return safe;
  }

  // POST /api/sessions/users/:userId/preferences — User prefs
  api.post("/sessions/users/:userId/preferences", async (req, res) => {
    try {
      const userId = safeUserId(req.params.userId);
      const prefs = req.body;
      const filename = `user-prefs-${userId}.json`;
      await memory.fileMemory.writeMemoryFile(filename, JSON.stringify(prefs, null, 2));
      res.json({ ok: true, userId });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/sessions/users/:userId/preferences — Get user prefs
  api.get("/sessions/users/:userId/preferences", (req, res) => {
    try {
      const userId = safeUserId(req.params.userId);
      const filename = `user-prefs-${userId}.json`;
      const memDir = path.join(config.projectRoot, "memory");
      const filePath = path.join(memDir, filename);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        return res.json(JSON.parse(content));
      }
      res.json({});
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Phase 8: Templates ───────────────────────────────────

  // GET /api/templates — List templates
  api.get("/templates", (_req, res) => {
    try {
      const db = memory.store?.db;
      if (!db) return res.json([]);
      const results = db.exec("SELECT * FROM agent_templates ORDER BY created_at DESC");
      if (!results.length) return res.json([]);
      const templates = results[0].values.map((row) => {
        const obj = {};
        results[0].columns.forEach((c, i) => {
          obj[c] = c === "config" ? JSON.parse(row[i] || "{}") : row[i];
        });
        return obj;
      });
      res.json(templates);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/templates — Save template
  api.post("/templates", (req, res) => {
    try {
      const { v4: uuidv4 } = require("uuid");
      const db = memory.store?.db;
      if (!db) return res.status(500).json({ error: "Database not available" });

      const id = uuidv4();
      const { name, description, config: tplConfig, category } = req.body;
      db.run(
        `INSERT INTO agent_templates (id, name, description, config, category) VALUES (?, ?, ?, ?, ?)`,
        [id, name || "Unnamed", description || "", JSON.stringify(tplConfig || {}), category || "general"]
      );
      res.status(201).json({ id, name, description, config: tplConfig, category });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/templates/:id — Get template
  api.get("/templates/:id", (req, res) => {
    try {
      const db = memory.store?.db;
      if (!db) return res.status(500).json({ error: "Database not available" });
      const stmt = db.prepare("SELECT * FROM agent_templates WHERE id = ?");
      stmt.bind([req.params.id]);
      if (stmt.step()) {
        const tpl = stmt.getAsObject();
        tpl.config = JSON.parse(tpl.config || "{}");
        stmt.free();
        return res.json(tpl);
      }
      stmt.free();
      res.status(404).json({ error: "Template not found" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/templates/:id — Delete template
  api.delete("/templates/:id", (req, res) => {
    try {
      const db = memory.store?.db;
      if (!db) return res.status(500).json({ error: "Database not available" });
      db.run("DELETE FROM agent_templates WHERE id = ?", [req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return api;
}

module.exports = { createChatRoutes };
