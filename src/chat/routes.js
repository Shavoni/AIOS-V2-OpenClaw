const express = require("express");
const { streamToSSE } = require("../router/stream");

function createChatRoutes(handler, memory, skills, agent, router) {
  const api = express.Router();

  // POST /api/chat — Send message (non-streaming)
  api.post("/chat", async (req, res) => {
    try {
      const { sessionId, message, profile } = req.body;
      if (!sessionId || !message) {
        return res.status(400).json({ error: "sessionId and message required" });
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
      const { sessionId, message, profile } = req.body;
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

  // GET /api/skills — List skills
  api.get("/skills", (_req, res) => {
    try {
      const allSkills = skills.getAllSkills().map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        capabilities: s.capabilities,
        hasScripts: s.hasScripts,
      }));
      res.json(allSkills);
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
  api.get("/memory/files", (_req, res) => {
    try {
      res.json(memory.listMemoryFiles());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return api;
}

module.exports = { createChatRoutes };
