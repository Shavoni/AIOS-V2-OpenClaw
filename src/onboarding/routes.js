/**
 * Onboarding API Routes — Discovery, wizard lifecycle, and one-click deploy.
 */

const express = require("express");
const { DiscoveryEngine } = require("./discovery");
const { asyncHandler } = require("../middleware/async-handler");

const _discoveryEngine = new DiscoveryEngine();

function createOnboardingRoutes(wizard) {
  const api = express.Router();

  // ─── Wizard Lifecycle ─────────────────────────────────────

  api.post("/start", asyncHandler((req, res) => {
    const { organizationName, websiteUrl, organizationType, manualEntry } = req.body;
    if (!organizationName) {
      return res.status(400).json({ error: "organizationName is required" });
    }

    let normalizedUrl = "";
    if (websiteUrl) {
      normalizedUrl = websiteUrl.trim();
      if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
        normalizedUrl = "https://" + normalizedUrl;
      }
      try { new URL(normalizedUrl); } catch {
        return res.status(400).json({ error: "Invalid URL format" });
      }
    } else if (!manualEntry) {
      return res.status(400).json({ error: "websiteUrl is required for non-manual onboarding" });
    }

    const state = wizard.startWizard({ organizationName, websiteUrl: normalizedUrl, organizationType });
    res.json(state);
  }));

  api.get("/wizards", asyncHandler((req, res) => {
    const includeCompleted = req.query.includeCompleted === "true";
    res.json(wizard.listWizards({ includeCompleted }));
  }));

  api.get("/wizards/:id", asyncHandler((req, res) => {
    const state = wizard.getWizard(req.params.id);
    if (!state) return res.status(404).json({ error: "Wizard not found" });
    res.json(state);
  }));

  api.delete("/wizards/:id", asyncHandler((req, res) => {
    res.json(wizard.deleteWizard(req.params.id));
  }));

  // ─── Discovery (async with polling) ───────────────────────

  api.post("/discover", asyncHandler((req, res) => {
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
  }));

  api.get("/discover/:jobId", asyncHandler((req, res) => {
    const result = _discoveryEngine.getStatus(req.params.jobId);
    if (!result) return res.status(404).json({ error: "Discovery job not found" });
    res.json(result);
  }));

  api.post("/wizards/:id/discover", asyncHandler(async (req, res) => {
    res.json(await wizard.runDiscovery(req.params.id));
  }));

  api.post("/wizards/:id/apply-discovery", asyncHandler((req, res) => {
    const { discoveryResult } = req.body;
    if (!discoveryResult) return res.status(400).json({ error: "discoveryResult required" });
    res.json(wizard.applyDiscoveryResult(req.params.id, discoveryResult));
  }));

  // ─── Template Matching ────────────────────────────────────

  api.post("/wizards/:id/match-templates", asyncHandler((req, res) => {
    res.json(wizard.matchTemplates(req.params.id));
  }));

  api.put("/wizards/:id/template", asyncHandler((req, res) => {
    const { templateId } = req.body;
    if (!templateId) return res.status(400).json({ error: "templateId required" });
    res.json(wizard.selectTemplate(req.params.id, templateId));
  }));

  // ─── Customization ───────────────────────────────────────

  api.put("/wizards/:id/departments/:name", asyncHandler((req, res) => {
    const { enabled, customName, customInstructions } = req.body;
    res.json(wizard.updateDepartment(req.params.id, decodeURIComponent(req.params.name), {
      enabled, customName, customInstructions,
    }));
  }));

  api.put("/wizards/:id/departments-bulk", asyncHandler((req, res) => {
    const { action, departments } = req.body;
    res.json(wizard.bulkUpdateDepartments(req.params.id, action, departments));
  }));

  // ─── Preview / Approval / Deploy ──────────────────────────

  api.post("/wizards/:id/preview", asyncHandler((req, res) => {
    res.json(wizard.generatePreview(req.params.id));
  }));

  api.post("/wizards/:id/approve/:index", asyncHandler((req, res) => {
    res.json(wizard.approveChecklistItem(req.params.id, parseInt(req.params.index, 10)));
  }));

  api.post("/wizards/:id/deploy", asyncHandler(async (req, res) => {
    const { skipApproval } = req.body;
    res.json(await wizard.deploy(req.params.id, { skipApproval }));
  }));

  return api;
}

module.exports = { createOnboardingRoutes };
