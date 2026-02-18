const express = require("express");
const { BackupService } = require("../db/backup-service");
const { RetentionService } = require("../db/retention-service");

function createSystemRoutes(llmConfig, branding, canon, agentManager, db, markDirty) {
  const router = express.Router();

  // ─── LLM Config ───────────────────────────────────────────

  // GET /api/system/llm-config
  router.get("/llm-config", (_req, res) => {
    try {
      res.json(llmConfig.get());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT/POST /api/system/llm-config
  router.put("/llm-config", (req, res) => {
    try {
      res.json(llmConfig.update(req.body));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  router.post("/llm-config", (req, res) => {
    try {
      res.json(llmConfig.update(req.body));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Branding ─────────────────────────────────────────────

  // GET /api/system/branding
  router.get("/branding", (_req, res) => {
    try {
      res.json(branding.get());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT/POST /api/system/branding
  router.put("/branding", (req, res) => {
    try {
      res.json(branding.update(req.body));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  router.post("/branding", (req, res) => {
    try {
      res.json(branding.update(req.body));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/system/branding/upload-logo
  router.post("/branding/upload-logo", (req, res) => {
    try {
      // Expects raw body or base64
      const { data, filename } = req.body;
      if (!data) return res.status(400).json({ error: "data required (base64)" });

      const buffer = Buffer.from(data, "base64");
      const result = branding.uploadLogo(buffer, filename || "logo.png");
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Shared Canon ─────────────────────────────────────────

  // GET /api/system/canon/documents
  router.get("/canon/documents", (_req, res) => {
    try {
      res.json(canon.listDocuments());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/system/canon/documents
  router.post("/canon/documents", (req, res) => {
    try {
      const doc = canon.addDocument(req.body);
      res.status(201).json(doc);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/system/canon/documents/:id
  router.delete("/canon/documents/:id", (req, res) => {
    try {
      canon.deleteDocument(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── LLM Usage Stats ─────────────────────────────────────

  // GET /api/system/llm-config/usage — 30-day LLM usage stats
  router.get("/llm-config/usage", (_req, res) => {
    try {
      const config = llmConfig.get();
      const providers = config.providers || {};
      const usage = {
        totalSpend: 0,
        totalTokens: 0,
        totalCalls: 0,
        byProvider: {},
      };

      // Aggregate usage from provider configs if they track it
      for (const [name, providerConfig] of Object.entries(providers)) {
        const stats = providerConfig.usage || providerConfig.stats || {};
        const spend = stats.spend || stats.cost || 0;
        const tokens = stats.tokens || stats.totalTokens || 0;
        const calls = stats.calls || stats.requests || 0;
        usage.totalSpend += spend;
        usage.totalTokens += tokens;
        usage.totalCalls += calls;
        usage.byProvider[name] = { spend, tokens, calls };
      }

      res.json(usage);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Pending Agents (from onboarding) ──────────────────

  // GET /api/system/pending-agents — List agents awaiting approval
  router.get("/pending-agents", (_req, res) => {
    try {
      if (!agentManager) return res.json([]);
      res.json(agentManager.getPendingAgents());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/system/pending-agents/:id/approve — Approve a pending agent
  router.post("/pending-agents/:id/approve", (req, res) => {
    try {
      if (!agentManager) return res.status(501).json({ error: "Agent manager not initialized" });
      const approvedBy = req.body.reviewer_id || req.body.approved_by || "admin";
      const updated = agentManager.approveAgent(req.params.id, approvedBy);
      if (!updated) return res.status(404).json({ error: "Agent not found or not pending" });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/system/pending-agents/:id/reject — Reject a pending agent
  router.post("/pending-agents/:id/reject", (req, res) => {
    try {
      if (!agentManager) return res.status(501).json({ error: "Agent manager not initialized" });
      const rejectedBy = req.body.reviewer_id || req.body.rejected_by || "admin";
      const reason = req.body.reason || "";
      const updated = agentManager.rejectAgent(req.params.id, rejectedBy, reason);
      if (!updated) return res.status(404).json({ error: "Agent not found or not pending" });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/system/pending-agents/approve-all — Bulk approve all pending agents
  router.post("/pending-agents/approve-all", (req, res) => {
    try {
      if (!agentManager) return res.json({ approved: 0 });
      const approvedBy = req.body.reviewer_id || "admin";
      const pending = agentManager.getPendingAgents();
      let approved = 0;
      for (const agent of pending) {
        if (agentManager.approveAgent(agent.id, approvedBy)) approved++;
      }
      res.json({ approved, total: pending.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── System Operations ────────────────────────────────────

  // POST /api/system/reset — Reset for new client
  router.post("/reset", (_req, res) => {
    try {
      // Clear agents, settings, canon but keep schema
      // This is intentionally limited to non-destructive operations
      res.json({ ok: true, message: "System reset is not yet implemented for safety" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/system/regenerate-concierge
  router.post("/regenerate-concierge", (_req, res) => {
    try {
      if (!agentManager) {
        return res.status(501).json({ error: "Agent manager not initialized" });
      }
      const concierge = agentManager.regenerateConcierge();
      res.json(concierge);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Data Retention ─────────────────────────────────────

  const retentionService = new RetentionService(db, markDirty);

  // GET /api/system/retention — Get current retention policy
  router.get("/retention", (_req, res) => {
    try {
      res.json(retentionService.getPolicy());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/system/retention — Update retention policy
  router.put("/retention", (req, res) => {
    try {
      retentionService.updatePolicy(req.body);
      res.json(retentionService.getPolicy());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/system/retention/purge — Run retention purge now
  router.post("/retention/purge", (_req, res) => {
    try {
      const result = retentionService.purge();
      res.json({ ok: true, purged: result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Backup & Restore ────────────────────────────────────

  // POST /api/system/backup — Create and download backup
  router.post("/backup", (_req, res) => {
    try {
      const backupService = new BackupService(db);
      const backup = backupService.createBackup();
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="aios-backup-${Date.now()}.db"`);
      res.send(backup);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/system/backup/validate — Validate a backup file
  router.post("/backup/validate", (req, res) => {
    try {
      const backupService = new BackupService(db);
      const { data } = req.body;
      if (!data) return res.status(400).json({ error: "data required (base64)" });
      const buffer = Buffer.from(data, 'base64');
      backupService.validateBackup(buffer);
      const meta = backupService.getBackupMetadata(buffer);
      res.json({ valid: true, ...meta });
    } catch (err) {
      res.status(400).json({ valid: false, error: err.message });
    }
  });

  return router;
}

module.exports = { createSystemRoutes };
