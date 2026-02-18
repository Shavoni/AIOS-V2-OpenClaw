/**
 * Onboarding API Routes — Discovery, wizard lifecycle, and one-click deploy.
 */

const express = require("express");
const { DiscoveryEngine } = require("./discovery");

// Shared discovery engine for background jobs
const _discoveryEngine = new DiscoveryEngine();

function createOnboardingRoutes(wizard) {
  const api = express.Router();

  // ─── Wizard Lifecycle ─────────────────────────────────────

  /** POST /api/onboarding/start — Start a new onboarding wizard */
  api.post("/start", (req, res) => {
    try {
      const { organizationName, websiteUrl, organizationType } = req.body;
      if (!organizationName || !websiteUrl) {
        return res.status(400).json({ error: "organizationName and websiteUrl are required" });
      }

      // Basic URL validation
      let normalizedUrl = websiteUrl.trim();
      if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
        normalizedUrl = "https://" + normalizedUrl;
      }
      try { new URL(normalizedUrl); } catch {
        return res.status(400).json({ error: "Invalid URL format" });
      }

      const state = wizard.startWizard({ organizationName, websiteUrl: normalizedUrl, organizationType });
      res.json(state);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /** GET /api/onboarding/wizards — List all wizards */
  api.get("/wizards", (req, res) => {
    try {
      const includeCompleted = req.query.includeCompleted === "true";
      res.json(wizard.listWizards({ includeCompleted }));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /** GET /api/onboarding/wizards/:id — Get wizard state */
  api.get("/wizards/:id", (req, res) => {
    try {
      const state = wizard.getWizard(req.params.id);
      if (!state) return res.status(404).json({ error: "Wizard not found" });
      res.json(state);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /** DELETE /api/onboarding/wizards/:id — Delete wizard */
  api.delete("/wizards/:id", (req, res) => {
    try {
      res.json(wizard.deleteWizard(req.params.id));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Discovery (async with polling) ───────────────────────

  /** POST /api/onboarding/discover — Start discovery as background job */
  api.post("/discover", (req, res) => {
    try {
      const { url } = req.body;
      if (!url) return res.status(400).json({ error: "url is required" });

      let normalizedUrl = url.trim();
      if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
        normalizedUrl = "https://" + normalizedUrl;
      }
      try { new URL(normalizedUrl); } catch {
        return res.status(400).json({ error: "Invalid URL format" });
      }

      const jobId = _discoveryEngine.startDiscovery(normalizedUrl);
      res.json({ job_id: jobId, status: "crawling" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /** GET /api/onboarding/discover/:jobId — Poll discovery status */
  api.get("/discover/:jobId", (req, res) => {
    try {
      const result = _discoveryEngine.getStatus(req.params.jobId);
      if (!result) return res.status(404).json({ error: "Discovery job not found" });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /** POST /api/onboarding/wizards/:id/discover — Run discovery synchronously (legacy) */
  api.post("/wizards/:id/discover", async (req, res) => {
    try {
      const state = await wizard.runDiscovery(req.params.id);
      res.json(state);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /** POST /api/onboarding/wizards/:id/apply-discovery — Apply discovery result to wizard */
  api.post("/wizards/:id/apply-discovery", (req, res) => {
    try {
      const { discoveryResult } = req.body;
      if (!discoveryResult) return res.status(400).json({ error: "discoveryResult required" });
      const state = wizard.applyDiscoveryResult(req.params.id, discoveryResult);
      res.json(state);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Template Matching ────────────────────────────────────

  /** POST /api/onboarding/wizards/:id/match-templates — Match templates */
  api.post("/wizards/:id/match-templates", (req, res) => {
    try {
      const state = wizard.matchTemplates(req.params.id);
      res.json(state);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /** PUT /api/onboarding/wizards/:id/template — Select template */
  api.put("/wizards/:id/template", (req, res) => {
    try {
      const { templateId } = req.body;
      if (!templateId) return res.status(400).json({ error: "templateId required" });
      const state = wizard.selectTemplate(req.params.id, templateId);
      res.json(state);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Customization ───────────────────────────────────────

  /** PUT /api/onboarding/wizards/:id/departments/:name — Update department */
  api.put("/wizards/:id/departments/:name", (req, res) => {
    try {
      const { enabled, customName, customInstructions } = req.body;
      const state = wizard.updateDepartment(req.params.id, decodeURIComponent(req.params.name), {
        enabled,
        customName,
        customInstructions,
      });
      res.json(state);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /** PUT /api/onboarding/wizards/:id/departments-bulk — Bulk update departments */
  api.put("/wizards/:id/departments-bulk", (req, res) => {
    try {
      const { action, departments } = req.body;
      // action: "enable-all", "disable-all", or "update" with departments array
      const state = wizard.bulkUpdateDepartments(req.params.id, action, departments);
      res.json(state);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Preview ──────────────────────────────────────────────

  /** POST /api/onboarding/wizards/:id/preview — Generate deployment preview */
  api.post("/wizards/:id/preview", (req, res) => {
    try {
      const state = wizard.generatePreview(req.params.id);
      res.json(state);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Approval ─────────────────────────────────────────────

  /** POST /api/onboarding/wizards/:id/approve/:index — Approve checklist item */
  api.post("/wizards/:id/approve/:index", (req, res) => {
    try {
      const state = wizard.approveChecklistItem(req.params.id, parseInt(req.params.index, 10));
      res.json(state);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Deploy ───────────────────────────────────────────────

  /** POST /api/onboarding/wizards/:id/deploy — One-click deploy */
  api.post("/wizards/:id/deploy", async (req, res) => {
    try {
      const { skipApproval } = req.body;
      const state = await wizard.deploy(req.params.id, { skipApproval });
      res.json(state);
    } catch (err) {
      res.status(err.message.includes("requires approval") ? 400 : 500).json({ error: err.message });
    }
  });

  return api;
}

module.exports = { createOnboardingRoutes };
