const express = require("express");
const { validate, schemas } = require("../middleware/validation");

function createAgentRoutes(agentManager, classifier, deps = {}) {
  const { rag, documentParser, webCrawler } = deps;
  const router = express.Router();

  // GET /api/agents — List all agents
  router.get("/", (_req, res) => {
    try {
      res.json(agentManager.listAgents());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/agents/:id — Get single agent
  router.get("/:id", (req, res) => {
    try {
      const agent = agentManager.getAgent(req.params.id);
      if (!agent) return res.status(404).json({ error: "Agent not found" });
      res.json(agent);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/agents — Create agent (always pending unless router)
  router.post("/", validate(schemas.createAgent), (req, res) => {
    try {
      const isRouter = req.body.is_router || false;
      const agent = agentManager.createAgent({
        ...req.body,
        status: isRouter ? "active" : "pending",
      });
      res.status(201).json(agent);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/agents/:id — Update agent
  router.put("/:id", (req, res) => {
    try {
      const agent = agentManager.updateAgent(req.params.id, req.body);
      if (!agent) return res.status(404).json({ error: "Agent not found" });
      res.json(agent);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/agents/:id — Delete agent
  router.delete("/:id", (req, res) => {
    try {
      agentManager.deleteAgent(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/agents/:id/enable — Enable agent
  router.post("/:id/enable", (req, res) => {
    try {
      const agent = agentManager.enableAgent(req.params.id);
      if (!agent) return res.status(404).json({ error: "Agent not found" });
      res.json(agent);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/agents/:id/disable — Disable agent
  router.post("/:id/disable", (req, res) => {
    try {
      const agent = agentManager.disableAgent(req.params.id);
      if (!agent) return res.status(404).json({ error: "Agent not found" });
      res.json(agent);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/agents/:id/query — Query agent with governance
  router.post("/:id/query", async (req, res) => {
    try {
      const { query } = req.body;
      if (!query) return res.status(400).json({ error: "query required" });

      const agent = agentManager.getAgent(req.params.id);
      if (!agent) return res.status(404).json({ error: "Agent not found" });

      res.json({
        agent: { id: agent.id, name: agent.name, domain: agent.domain },
        response: `[Agent ${agent.name}] Query received. Agent processing is handled through the chat system.`,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/agents/route — Intelligent routing
  router.post("/route", (req, res) => {
    try {
      const { query } = req.body;
      if (!query) return res.status(400).json({ error: "query required" });

      const result = agentManager.routeQuery(query, classifier);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Knowledge documents
  router.get("/:id/knowledge", (req, res) => {
    try {
      res.json(agentManager.listKnowledgeDocuments(req.params.id));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  const ALLOWED_KNOWLEDGE_TYPES = new Set(["txt", "md", "pdf", "docx", "json", "csv", "html", "xml", "yaml", "yml"]);

  router.post("/:id/knowledge", async (req, res) => {
    try {
      const fileType = (req.body.file_type || "").toLowerCase();
      if (!ALLOWED_KNOWLEDGE_TYPES.has(fileType)) {
        return res.status(400).json({ error: `File type '${fileType}' not allowed. Allowed: ${[...ALLOWED_KNOWLEDGE_TYPES].join(", ")}` });
      }
      if (req.body.file_size && req.body.file_size > 10 * 1024 * 1024) {
        return res.status(400).json({ error: "File size exceeds 10MB limit" });
      }

      const docData = { ...req.body };
      let parsedText = docData.content || "";

      // Parse content through DocumentParser if available
      if (parsedText && documentParser) {
        const parseResult = await documentParser.parse(parsedText, fileType, {
          encoding: docData.encoding || undefined,
        });
        parsedText = parseResult.text || "";
      }

      // Persist parsed content in metadata for restart re-indexing
      if (parsedText) {
        const existingMeta = docData.metadata || {};
        docData.metadata = { ...existingMeta, content: parsedText };
        delete docData.content;
        delete docData.encoding;
      }

      const doc = agentManager.addKnowledgeDocument(req.params.id, docData);

      // Auto-index into RAG pipeline if content and rag are available
      let chunkCount = 0;
      if (parsedText && rag) {
        chunkCount = rag.indexDocument(req.params.id, doc.id, parsedText, {
          filename: doc.filename,
          file_type: doc.file_type,
        });
        if (typeof chunkCount === "number") {
          // Update chunk_count on the document
          agentManager.updateKnowledgeDocument(doc.id, { chunk_count: chunkCount });
        }
      }

      res.status(201).json({ ...doc, chunk_count: typeof chunkCount === "number" ? chunkCount : 0 });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET single document
  router.get("/:id/knowledge/:docId", (req, res) => {
    try {
      const doc = agentManager.getKnowledgeDocument(req.params.docId);
      if (!doc) return res.status(404).json({ error: "Document not found" });
      res.json(doc);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT — update a knowledge document
  router.put("/:id/knowledge/:docId", (req, res) => {
    try {
      const updated = agentManager.updateKnowledgeDocument(req.params.docId, req.body);
      if (!updated) return res.status(404).json({ error: "Document not found" });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST — soft delete
  router.post("/:id/knowledge/:docId/archive", (req, res) => {
    try {
      const result = agentManager.softDeleteDocument(req.params.docId);
      if (!result) return res.status(404).json({ error: "Document not found" });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST — restore soft-deleted document
  router.post("/:id/knowledge/:docId/restore", (req, res) => {
    try {
      const result = agentManager.restoreDocument(req.params.docId);
      if (!result) return res.status(404).json({ error: "Document not found" });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE — hard delete
  router.delete("/:id/knowledge/:docId", (req, res) => {
    try {
      agentManager.hardDeleteDocument(req.params.docId);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST — batch soft-delete
  router.post("/:id/knowledge/batch-delete", (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) return res.status(400).json({ error: "ids array required" });
      const result = agentManager.batchDeleteDocuments(ids);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET — KB stats/health
  router.get("/:id/kb/stats", (req, res) => {
    try {
      res.json(agentManager.getKBStats(req.params.id));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET — KB coverage analysis
  router.get("/:id/kb/coverage", (req, res) => {
    try {
      const analysis = agentManager.getKBCoverageAnalysis(req.params.id);
      if (!analysis) return res.status(404).json({ error: "Agent not found" });
      res.json(analysis);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST — populate KB from research
  router.post("/:id/kb/populate-from-research", (req, res) => {
    try {
      const { jobId, sources, threshold } = req.body;
      if (!sources) return res.status(400).json({ error: "sources array required" });
      const result = agentManager.populateKBFromResearch(req.params.id, { jobId, sources, threshold });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Web sources
  router.get("/:id/sources", (req, res) => {
    try {
      res.json(agentManager.listWebSources(req.params.id));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/:id/sources", (req, res) => {
    try {
      const source = agentManager.addWebSource(req.params.id, req.body);
      res.status(201).json(source);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST — refresh all stale web sources (must come before :sourceId routes)
  router.post("/:id/sources/refresh-all", async (req, res) => {
    try {
      if (!webCrawler || !rag) return res.status(501).json({ error: "Web crawling not configured" });
      const sources = agentManager.listWebSources(req.params.id);
      const stats = await webCrawler.refreshAllStale(sources, { rag, agentManager });
      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST — refresh a single web source
  router.post("/:id/sources/:sourceId/refresh", async (req, res) => {
    try {
      if (!webCrawler || !rag) return res.status(501).json({ error: "Web crawling not configured" });
      const sources = agentManager.listWebSources(req.params.id);
      const source = sources.find(s => s.id === req.params.sourceId);
      if (!source) return res.status(404).json({ error: "Web source not found" });
      const result = await webCrawler.refreshWebSource(
        { ...source, agent_id: req.params.id },
        { rag, agentManager }
      );
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT — update web source
  router.put("/:id/sources/:sourceId", (req, res) => {
    try {
      const updated = agentManager.updateWebSource(req.params.sourceId, req.body);
      if (!updated) return res.status(404).json({ error: "Web source not found" });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete("/:id/sources/:sourceId", (req, res) => {
    try {
      agentManager.deleteWebSource(req.params.sourceId);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createAgentRoutes };
