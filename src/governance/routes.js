const express = require("express");
const { validate, schemas } = require("../middleware/validation");

function createGovernanceRoutes(governanceEngine) {
  const router = express.Router();

  // POST /api/governance/evaluate — Full evaluation (dry-run)
  router.post("/evaluate", (req, res) => {
    try {
      const { query } = req.body;
      if (!query) return res.status(400).json({ error: "query required" });

      const classifier = governanceEngine.classifier;
      const riskDetector = governanceEngine.riskDetector;

      const intent = classifier.classify(query);
      const risk = riskDetector.detect(query);
      const decision = governanceEngine.evaluate(intent, risk);

      res.json({ intent, risk, decision });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/governance/rules — List all rules
  router.get("/rules", (_req, res) => {
    try {
      const rules = governanceEngine.listRules
        ? governanceEngine.listRules()
        : governanceEngine.rules.map((r) => ({
            id: r.id,
            description: r.description,
            name: r.name || r.id,
            tier: r.tier || "standard",
            hitl_mode: r.hitl_mode || "INFORM",
            is_immutable: r.is_immutable || false,
          }));
      res.json(rules);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/governance/rules — Create rule
  router.post("/rules", validate(schemas.createRule), (req, res) => {
    try {
      if (!governanceEngine.createRule) {
        return res.status(501).json({ error: "Dynamic rules not initialized" });
      }
      const rule = governanceEngine.createRule(req.body);
      res.status(201).json(rule);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/governance/rules/:id — Update rule
  router.put("/rules/:id", (req, res) => {
    try {
      if (!governanceEngine.updateRule) {
        return res.status(501).json({ error: "Dynamic rules not initialized" });
      }
      const rule = governanceEngine.updateRule(req.params.id, req.body);
      if (!rule) return res.status(404).json({ error: "Rule not found" });
      res.json(rule);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/governance/rules/:id — Delete rule
  router.delete("/rules/:id", (req, res) => {
    try {
      if (!governanceEngine.deleteRule) {
        return res.status(501).json({ error: "Dynamic rules not initialized" });
      }
      governanceEngine.deleteRule(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/governance/versions — Version history
  router.get("/versions", (_req, res) => {
    try {
      if (!governanceEngine.getVersions) {
        return res.json([]);
      }
      res.json(governanceEngine.getVersions());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/governance/versions/:id/rollback — Rollback to version
  router.post("/versions/:id/rollback", (req, res) => {
    try {
      if (!governanceEngine.rollback) {
        return res.status(501).json({ error: "Versioning not initialized" });
      }
      const result = governanceEngine.rollback(req.params.id);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/governance/prohibited-topics — List prohibited topics
  router.get("/prohibited-topics", (_req, res) => {
    try {
      if (!governanceEngine.listProhibitedTopics) {
        return res.json([]);
      }
      res.json(governanceEngine.listProhibitedTopics());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/governance/prohibited-topics — Add prohibited topic
  router.post("/prohibited-topics", (req, res) => {
    try {
      if (!governanceEngine.addProhibitedTopic) {
        return res.status(501).json({ error: "Not initialized" });
      }
      const result = governanceEngine.addProhibitedTopic(req.body.topic, req.body.scope);
      res.status(201).json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createGovernanceRoutes };
