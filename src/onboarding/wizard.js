/**
 * Onboarding Wizard — Full lifecycle from URL discovery to one-click deploy.
 * Port of V1 Python OnboardingWizard.
 */

const { v4: uuidv4 } = require("uuid");
const { DiscoveryEngine, DEPARTMENT_KEYWORDS } = require("./discovery");
const { LLMDiscoveryEngine } = require("./llm-discovery");

// Wizard steps
const STEPS = {
  INIT: "init",
  DISCOVERY: "discovery",
  ANALYSIS: "analysis",
  TEMPLATE_MATCH: "template_match",
  CUSTOMIZATION: "customization",
  PREVIEW: "preview",
  DEPLOYMENT: "deployment",
  COMPLETE: "complete",
  ERROR: "error",
};

// Confidence levels
function confidenceLevel(score) {
  if (score >= 0.85) return "high";
  if (score >= 0.60) return "medium";
  if (score >= 0.40) return "low";
  return "very_low";
}

class OnboardingWizard {
  /**
   * @param {object} db - sql.js database
   * @param {Function} saveFn - markDirty function
   * @param {object} [opts]
   * @param {object} [opts.agentManager] - AgentManagerService for deployment
   * @param {object} [opts.router] - ModelRouter for LLM-enhanced discovery
   */
  constructor(db, saveFn, opts = {}) {
    this.db = db;
    this.saveFn = saveFn || (() => {});
    this.agentManager = opts.agentManager || null;
    this.router = opts.router || null;

    this._discoveryEngine = new DiscoveryEngine();
    this._llmEngine = this.router ? new LLMDiscoveryEngine(this.router) : null;
  }

  // ─── Wizard Lifecycle ─────────────────────────────────────

  startWizard({ organizationName, websiteUrl, organizationType = "municipal" }) {
    const id = uuidv4().slice(0, 8);
    const now = new Date().toISOString();

    this.db.run(
      `INSERT INTO onboarding_wizards
       (id, organization_name, website_url, organization_type, step, progress, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, organizationName, websiteUrl, organizationType, STEPS.INIT, 5, now, now]
    );
    this.saveFn();

    return this.getWizard(id);
  }

  getWizard(id) {
    const stmt = this.db.prepare("SELECT * FROM onboarding_wizards WHERE id = ?");
    stmt.bind([id]);
    let wizard = null;
    if (stmt.step()) {
      wizard = stmt.getAsObject();
      wizard.departments = JSON.parse(wizard.departments || "[]");
      wizard.template_matches = JSON.parse(wizard.template_matches || "[]");
      wizard.preview = JSON.parse(wizard.preview || "null");
      wizard.deployment_errors = JSON.parse(wizard.deployment_errors || "[]");
      wizard.approval_checklist = JSON.parse(wizard.approval_checklist || "[]");
      wizard.discovery_result = JSON.parse(wizard.discovery_result || "{}");
    }
    stmt.free();
    return wizard;
  }

  listWizards({ includeCompleted = false } = {}) {
    let sql = "SELECT id, organization_name, website_url, step, progress, created_at FROM onboarding_wizards";
    if (!includeCompleted) {
      sql += " WHERE step NOT IN ('complete', 'error')";
    }
    sql += " ORDER BY created_at DESC";

    const results = this.db.exec(sql);
    if (!results.length) return [];

    const { columns, values } = results[0];
    return values.map((row) => {
      const obj = {};
      columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    });
  }

  deleteWizard(id) {
    this.db.run("DELETE FROM onboarding_wizards WHERE id = ?", [id]);
    this.saveFn();
    return { ok: true };
  }

  // ─── Step: Discovery ──────────────────────────────────────

  async runDiscovery(wizardId) {
    const wizard = this.getWizard(wizardId);
    if (!wizard) throw new Error(`Wizard ${wizardId} not found`);

    this._updateWizard(wizardId, { step: STEPS.DISCOVERY, progress: 10 });

    try {
      // Run the crawler
      const result = await this._discoveryEngine.discover(wizard.website_url);

      // Try LLM enhancement if router available
      let enhanced = result;
      if (this._llmEngine && Object.keys(result).length > 0) {
        try {
          // We don't have pages content for LLM here since discover() doesn't return them
          // The LLM enhancement would need a separate crawl — skip for now, use regex results
        } catch { /* non-critical */ }
      }

      // Convert discovered departments to wizard format
      const departments = (enhanced.departments || []).map((dept) => ({
        name: dept.name,
        url: dept.url || "",
        description: dept.description || "",
        confidence: {
          score: dept.url ? 0.7 : 0.4,
          level: confidenceLevel(dept.url ? 0.7 : 0.4),
          reason: "Detected from website structure",
          evidence: dept.url ? [`Found at ${dept.url}`] : [],
        },
        suggestedDomain: this._inferDomain(dept.name),
        suggestedTemplate: dept.suggestedTemplate || null,
        suggestedCapabilities: this._inferCapabilities(dept.name),
        suggestedModel: "gpt-4o-mini",
        enabled: true,
        customName: "",
        customInstructions: "",
        director: dept.director || null,
        directorTitle: dept.directorTitle || null,
      }));

      this._updateWizard(wizardId, {
        step: STEPS.ANALYSIS,
        progress: 30,
        departments: JSON.stringify(departments),
        discovery_result: JSON.stringify({
          municipality: enhanced.municipality,
          executive: enhanced.executive,
          chiefOfficers: enhanced.chiefOfficers || [],
          dataPortals: enhanced.dataPortals || [],
          governanceDocs: enhanced.governanceDocs || [],
          pagesCrawled: enhanced.pagesCrawled || 0,
        }),
      });

      return this.getWizard(wizardId);
    } catch (err) {
      this._updateWizard(wizardId, {
        step: STEPS.ERROR,
        deployment_errors: JSON.stringify([`Discovery failed: ${err.message}`]),
      });
      return this.getWizard(wizardId);
    }
  }

  /**
   * Apply a raw discovery result (from polling API) to a wizard.
   */
  applyDiscoveryResult(wizardId, result) {
    const wizard = this.getWizard(wizardId);
    if (!wizard) throw new Error(`Wizard ${wizardId} not found`);

    const departments = (result.departments || []).map((dept) => ({
      name: dept.name,
      url: dept.url || "",
      description: dept.description || "",
      confidence: {
        score: dept.url ? 0.7 : 0.4,
        level: confidenceLevel(dept.url ? 0.7 : 0.4),
        reason: "Detected from website structure",
        evidence: dept.url ? [`Found at ${dept.url}`] : [],
      },
      suggestedDomain: this._inferDomain(dept.name),
      suggestedTemplate: dept.suggestedTemplate || null,
      suggestedCapabilities: this._inferCapabilities(dept.name),
      suggestedModel: "gpt-4o-mini",
      enabled: true,
      customName: "",
      customInstructions: "",
      director: dept.director || null,
      directorTitle: dept.directorTitle || null,
    }));

    this._updateWizard(wizardId, {
      step: STEPS.ANALYSIS,
      progress: 30,
      departments: JSON.stringify(departments),
      discovery_result: JSON.stringify({
        municipality: result.municipality || null,
        executive: result.executive || null,
        chiefOfficers: result.chiefOfficers || [],
        dataPortals: result.dataPortals || [],
        governanceDocs: result.governanceDocs || [],
        pagesCrawled: result.pagesCrawled || 0,
      }),
    });

    return this.getWizard(wizardId);
  }

  /**
   * Bulk update departments (enable-all, disable-all, or individual updates).
   */
  bulkUpdateDepartments(wizardId, action, departmentUpdates) {
    const wizard = this.getWizard(wizardId);
    if (!wizard) throw new Error(`Wizard ${wizardId} not found`);

    const departments = wizard.departments || [];

    if (action === "enable-all") {
      departments.forEach((d) => { d.enabled = true; });
    } else if (action === "disable-all") {
      departments.forEach((d) => { d.enabled = false; });
    } else if (action === "update" && Array.isArray(departmentUpdates)) {
      for (const update of departmentUpdates) {
        const dept = departments.find((d) => d.name === update.name);
        if (!dept) continue;
        if (update.enabled !== undefined) dept.enabled = update.enabled;
        if (update.customName !== undefined) dept.customName = update.customName;
        if (update.customInstructions !== undefined) dept.customInstructions = update.customInstructions;
      }
    }

    this._updateWizard(wizardId, { departments: JSON.stringify(departments) });
    return this.getWizard(wizardId);
  }

  // ─── Step: Template Matching ──────────────────────────────

  matchTemplates(wizardId) {
    const wizard = this.getWizard(wizardId);
    if (!wizard) throw new Error(`Wizard ${wizardId} not found`);

    const departments = wizard.departments || [];

    // Get available agent templates from DB
    const templates = this._getTemplates();

    // Score each template against the organization
    const matches = templates.map((tmpl) => {
      const score = this._scoreTemplateMatch(departments, tmpl, wizard.organization_type);
      return {
        templateId: tmpl.id,
        templateName: tmpl.name,
        confidence: score,
        modificationsNeeded: this._getModificationsNeeded(departments, tmpl),
      };
    });

    // Sort by confidence
    matches.sort((a, b) => b.confidence.score - a.confidence.score);

    // Auto-select best if high confidence
    let selectedTemplate = "";
    if (matches.length && matches[0].confidence.level === "high") {
      selectedTemplate = matches[0].templateId;
    }

    this._updateWizard(wizardId, {
      step: STEPS.CUSTOMIZATION,
      progress: 60,
      template_matches: JSON.stringify(matches),
      selected_template: selectedTemplate,
    });

    return this.getWizard(wizardId);
  }

  // ─── Step: Customization ──────────────────────────────────

  updateDepartment(wizardId, departmentName, updates) {
    const wizard = this.getWizard(wizardId);
    if (!wizard) throw new Error(`Wizard ${wizardId} not found`);

    const departments = wizard.departments || [];
    for (const dept of departments) {
      if (dept.name === departmentName) {
        if (updates.enabled !== undefined) dept.enabled = updates.enabled;
        if (updates.customName !== undefined) dept.customName = updates.customName;
        if (updates.customInstructions !== undefined) dept.customInstructions = updates.customInstructions;
        break;
      }
    }

    this._updateWizard(wizardId, { departments: JSON.stringify(departments) });
    return this.getWizard(wizardId);
  }

  selectTemplate(wizardId, templateId) {
    this._updateWizard(wizardId, { selected_template: templateId });
    return this.getWizard(wizardId);
  }

  // ─── Step: Preview ────────────────────────────────────────

  generatePreview(wizardId) {
    const wizard = this.getWizard(wizardId);
    if (!wizard) throw new Error(`Wizard ${wizardId} not found`);

    const enabledDepts = (wizard.departments || []).filter((d) => d.enabled);

    // Build agent list
    const agents = enabledDepts.map((dept) => ({
      name: dept.customName || dept.name,
      domain: dept.suggestedDomain,
      capabilities: dept.suggestedCapabilities,
      model: dept.suggestedModel || "gpt-4o-mini",
      confidence: dept.confidence.score,
      director: dept.director,
      directorTitle: dept.directorTitle,
    }));

    // Add concierge router
    agents.unshift({
      name: "Concierge",
      domain: "Router",
      capabilities: ["routing", "general inquiry"],
      model: "gpt-4o",
      isRouter: true,
    });

    // Estimate costs
    const baseCost = 50;
    const perAgentCost = 15;
    const estimatedCost = baseCost + agents.length * perAgentCost;

    // Check for review items
    const warnings = [];
    const requiresReview = [];

    const lowConfidence = enabledDepts.filter(
      (d) => d.confidence && (d.confidence.level === "low" || d.confidence.level === "very_low")
    );
    if (lowConfidence.length) {
      requiresReview.push(`${lowConfidence.length} department(s) have low detection confidence`);
    }
    if (agents.length > 10) {
      warnings.push("Large number of agents may increase costs and complexity");
    }

    const discoveryResult = wizard.discovery_result || {};
    const kbSources = enabledDepts.filter((d) => d.url).map((d) => d.url);

    const preview = {
      organizationName: wizard.organization_name,
      agents,
      agentCount: agents.length,
      kbDocuments: enabledDepts.length * 15,
      kbSources,
      policies: ["default_governance", "hitl_legal", "hitl_finance"],
      hitlRules: ["legal_review", "financial_approval", "public_comms"],
      estimatedMonthlyCost: estimatedCost,
      estimatedSetupTimeMinutes: 5 + agents.length * 2,
      warnings,
      requiresReview,
      dataPortals: discoveryResult.dataPortals || [],
      governanceDocs: discoveryResult.governanceDocs || [],
    };

    const requiresApproval = requiresReview.length > 0;
    const checklist = requiresReview.map((item) => ({ item, approved: false }));

    this._updateWizard(wizardId, {
      step: STEPS.PREVIEW,
      progress: 75,
      preview: JSON.stringify(preview),
      requires_approval: requiresApproval ? 1 : 0,
      approval_checklist: JSON.stringify(checklist),
    });

    return this.getWizard(wizardId);
  }

  // ─── Step: Deploy ─────────────────────────────────────────

  async deploy(wizardId, { skipApproval = false } = {}) {
    const wizard = this.getWizard(wizardId);
    if (!wizard) throw new Error(`Wizard ${wizardId} not found`);

    // Check approvals
    if (wizard.requires_approval && !skipApproval) {
      const pending = (wizard.approval_checklist || []).filter((c) => !c.approved);
      if (pending.length) {
        throw new Error(`Deployment requires approval: ${pending.length} item(s) pending`);
      }
    }

    const deploymentId = uuidv4().slice(0, 8);
    this._updateWizard(wizardId, {
      step: STEPS.DEPLOYMENT,
      progress: 85,
      deployment_id: deploymentId,
      deployment_status: "creating_agents",
    });

    try {
      const preview = wizard.preview;
      if (!preview) throw new Error("No preview generated — run generatePreview first");

      // Create agents via AgentManagerService
      // Non-router agents are created as "pending" for HITL approval.
      // The router (Concierge) is always active since it's a system agent.
      if (this.agentManager) {
        for (const agentConfig of preview.agents || []) {
          const isRouter = agentConfig.isRouter || false;
          const agent = this.agentManager.createAgent({
            name: agentConfig.name,
            domain: agentConfig.domain,
            description: `Auto-deployed for ${wizard.organization_name}. ${agentConfig.capabilities.join(", ")}`,
            capabilities: agentConfig.capabilities || [],
            status: isRouter ? "active" : "pending",
            is_router: isRouter,
          });

          // Provision KB from discovered web sources for non-router agents
          if (!isRouter && agent) {
            const deptSources = (wizard.departments || [])
              .filter(d => d.enabled && d.url && d.suggestedDomain === agentConfig.domain)
              .map(d => ({ url: d.url, name: d.name }));
            if (deptSources.length > 0) {
              this.agentManager.provisionKBFromWebSources(agent.id, deptSources);
            }
          }
        }

        // Regenerate concierge to know about new agents
        this.agentManager.regenerateConcierge();
      }

      this._updateWizard(wizardId, {
        step: STEPS.COMPLETE,
        progress: 100,
        deployment_status: "complete",
        completed_at: new Date().toISOString(),
      });
    } catch (err) {
      this._updateWizard(wizardId, {
        step: STEPS.ERROR,
        deployment_status: "failed",
        deployment_errors: JSON.stringify([...(wizard.deployment_errors || []), err.message]),
      });
    }

    return this.getWizard(wizardId);
  }

  approveChecklistItem(wizardId, itemIndex) {
    const wizard = this.getWizard(wizardId);
    if (!wizard) throw new Error(`Wizard ${wizardId} not found`);

    const checklist = wizard.approval_checklist || [];
    if (itemIndex >= 0 && itemIndex < checklist.length) {
      checklist[itemIndex].approved = true;
    }

    const allApproved = checklist.every((c) => c.approved);

    this._updateWizard(wizardId, {
      approval_checklist: JSON.stringify(checklist),
      requires_approval: allApproved ? 0 : 1,
    });

    return this.getWizard(wizardId);
  }

  // ─── Internal Helpers ─────────────────────────────────────

  _updateWizard(id, fields) {
    const ALLOWED = new Set([
      "step", "progress", "departments", "template_matches", "selected_template",
      "preview", "deployment_id", "deployment_status", "deployment_errors",
      "requires_approval", "approval_checklist", "completed_at", "discovery_result",
    ]);

    const sets = [];
    const values = [];
    for (const [key, val] of Object.entries(fields)) {
      if (!ALLOWED.has(key)) continue;
      sets.push(`${key} = ?`);
      values.push(val);
    }
    sets.push("updated_at = ?");
    values.push(new Date().toISOString());
    values.push(id);

    if (sets.length > 1) {
      this.db.run(`UPDATE onboarding_wizards SET ${sets.join(", ")} WHERE id = ?`, values);
      this.saveFn();
    }
  }

  _getTemplates() {
    const results = this.db.exec("SELECT * FROM agent_templates ORDER BY name");
    if (!results.length) {
      // Return built-in templates if none in DB
      return this._getBuiltinTemplates();
    }
    const { columns, values } = results[0];
    const templates = values.map((row) => {
      const obj = {};
      columns.forEach((col, i) => { obj[col] = row[i]; });
      try { obj.config = JSON.parse(obj.config || "{}"); } catch { obj.config = {}; }
      return obj;
    });
    return templates.length ? templates : this._getBuiltinTemplates();
  }

  _getBuiltinTemplates() {
    return [
      { id: "municipal-full", name: "Municipal Government (Full)", category: "municipal",
        config: { type: "municipal", agents: [
          { domain: "HR" }, { domain: "Finance" }, { domain: "Legal" },
          { domain: "PublicHealth" }, { domain: "PublicSafety" }, { domain: "Parks" },
          { domain: "Building" }, { domain: "Utilities" }, { domain: "IT" },
          { domain: "Communications" },
        ]} },
      { id: "municipal-lite", name: "Municipal Government (Lite)", category: "municipal",
        config: { type: "municipal", agents: [
          { domain: "HR" }, { domain: "Finance" }, { domain: "PublicSafety" },
          { domain: "Building" },
        ]} },
      { id: "enterprise", name: "Enterprise", category: "enterprise",
        config: { type: "enterprise", agents: [
          { domain: "HR" }, { domain: "Finance" }, { domain: "Legal" }, { domain: "IT" },
        ]} },
      { id: "nonprofit", name: "Nonprofit Organization", category: "nonprofit",
        config: { type: "nonprofit", agents: [
          { domain: "General" }, { domain: "Finance" }, { domain: "Communications" },
        ]} },
    ];
  }

  _scoreTemplateMatch(departments, template, orgType) {
    let score = 0.5;
    const evidence = [];

    // Type match
    if (template.config?.type === orgType || template.category === orgType) {
      score += 0.2;
      evidence.push(`Organization type matches: ${orgType}`);
    }

    // Department domain coverage
    const templateDomains = new Set((template.config?.agents || []).map((a) => a.domain));
    const orgDomains = new Set(departments.map((d) => d.suggestedDomain));

    let overlap = 0;
    for (const d of orgDomains) {
      if (templateDomains.has(d)) overlap++;
    }

    if (overlap > 0) {
      const coverage = overlap / Math.max(orgDomains.size, 1);
      score += coverage * 0.3;
      evidence.push(`${overlap} domain(s) match template`);
    }

    return {
      score: Math.min(score, 1.0),
      level: confidenceLevel(Math.min(score, 1.0)),
      reason: `Template match for ${orgType}`,
      evidence,
    };
  }

  _getModificationsNeeded(departments, template) {
    const templateDomains = new Set((template.config?.agents || []).map((a) => a.domain));
    const orgDomains = new Set(departments.map((d) => d.suggestedDomain));

    const mods = [];
    const missing = [...orgDomains].filter((d) => !templateDomains.has(d));
    const extra = [...templateDomains].filter((d) => !orgDomains.has(d));

    if (missing.length) mods.push(`Add agents for: ${missing.join(", ")}`);
    if (extra.length) mods.push(`Remove unused agents: ${extra.join(", ")}`);

    return mods;
  }

  _inferDomain(name) {
    const lower = name.toLowerCase();
    const domainMap = {
      HR: ["hr", "human resource", "personnel", "employee"],
      Finance: ["finance", "budget", "treasury", "accounting"],
      Legal: ["legal", "law", "attorney", "counsel"],
      Building: ["building", "permit", "zoning", "planning"],
      PublicHealth: ["health", "medical", "clinic"],
      PublicSafety: ["police", "fire", "safety", "emergency"],
      Parks: ["parks", "recreation", "community"],
      Utilities: ["water", "utilities", "electric", "sewer"],
      IT: ["technology", "it", "information technology", "innovation"],
      Communications: ["communications", "media", "public affairs"],
    };

    for (const [domain, keywords] of Object.entries(domainMap)) {
      if (keywords.some((kw) => lower.includes(kw))) return domain;
    }
    return "General";
  }

  _inferCapabilities(name) {
    const lower = name.toLowerCase();

    if (lower.match(/hr|human/)) return ["benefits", "policies", "onboarding", "leave"];
    if (lower.match(/finance|budget/)) return ["budgets", "payments", "procurement", "reporting"];
    if (lower.match(/legal/)) return ["contracts", "compliance", "records"];
    if (lower.match(/building|permit/)) return ["permits", "inspections", "zoning", "codes"];
    if (lower.match(/health/)) return ["programs", "clinics", "compliance", "outreach"];
    if (lower.match(/police|safety/)) return ["reports", "community programs", "statistics"];
    if (lower.match(/fire|emergency/)) return ["prevention", "inspections", "emergency info"];
    if (lower.match(/parks|recreation/)) return ["programs", "reservations", "events"];
    if (lower.match(/water|utilities/)) return ["billing", "service requests", "outages"];
    if (lower.match(/technology|it/)) return ["support", "systems", "infrastructure"];

    return ["general inquiry", "information"];
  }
}

module.exports = { OnboardingWizard, STEPS };
