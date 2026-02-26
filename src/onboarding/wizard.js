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
   * @param {object} [opts.templateRegistry] - TemplateRegistry for industry templates
   * @param {object} [opts.domainRegistry] - DomainRegistry for governance domains
   * @param {object} [opts.riskSignalRegistry] - RiskSignalRegistry for risk signals
   */
  constructor(db, saveFn, opts = {}) {
    this.db = db;
    this.saveFn = saveFn || (() => {});
    this.agentManager = opts.agentManager || null;
    this.router = opts.router || null;
    this.templateRegistry = opts.templateRegistry || null;
    this.domainRegistry = opts.domainRegistry || null;
    this.riskSignalRegistry = opts.riskSignalRegistry || null;

    this._discoveryEngine = new DiscoveryEngine();
    this._llmEngine = this.router ? new LLMDiscoveryEngine(this.router) : null;
  }

  // ─── Wizard Lifecycle ─────────────────────────────────────

  startWizard({ organizationName, websiteUrl, organizationType = "municipal", sector = null }) {
    const id = uuidv4().slice(0, 8);
    const now = new Date().toISOString();

    // Sector overrides organizationType when provided
    const effectiveType = sector || organizationType;

    this.db.run(
      `INSERT INTO onboarding_wizards
       (id, organization_name, website_url, organization_type, step, progress, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, organizationName, websiteUrl, effectiveType, STEPS.INIT, 5, now, now]
    );
    this.saveFn();

    return this.getWizard(id);
  }

  /**
   * List available sectors from the template registry.
   * @returns {Array} Sectors with template counts
   */
  listSectors() {
    if (!this.templateRegistry) return [];
    return this.templateRegistry.listSectors();
  }

  /**
   * Set the sector for a wizard and apply template-driven department suggestions.
   */
  setSector(wizardId, sector) {
    const wizard = this.getWizard(wizardId);
    if (!wizard) throw new Error(`Wizard ${wizardId} not found`);

    this._updateWizard(wizardId, { organization_type: sector });

    // If template registry available, suggest departments from best-fit template
    if (this.templateRegistry) {
      const templates = this.templateRegistry.getTemplatesForSector(sector);
      if (templates.length > 0) {
        // Pick the first (most general) template as default suggestion
        const tmpl = templates[0];
        const departments = (tmpl.departments || []).map((dept) => {
          const name = typeof dept === 'string' ? dept : dept.name;
          const domain = (typeof dept === 'object' && dept.domain) ? dept.domain : this._inferDomain(name);
          const caps = (typeof dept === 'object' && Array.isArray(dept.capabilities)) ? dept.capabilities : this._inferCapabilities(name);
          return {
          name,
          url: "",
          description: "",
          confidence: { score: 0.5, level: "medium", reason: "Template default", evidence: [] },
          suggestedDomain: domain,
          suggestedTemplate: tmpl.id,
          suggestedCapabilities: caps,
          suggestedModel: "gpt-4o-mini",
          enabled: true,
          customName: "",
          customInstructions: "",
          director: null,
          directorTitle: null,
        };
        });

        this._updateWizard(wizardId, {
          departments: JSON.stringify(departments),
          selected_template: tmpl.id,
        });
      }
    }

    return this.getWizard(wizardId);
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

      // Try LLM enhancement if router available and pages were captured
      let enhanced = result;
      if (this._llmEngine && Object.keys(result).length > 0 && result._pages) {
        try {
          enhanced = await this._llmEngine.enhance(result, result._pages);
        } catch { /* non-critical — fall back to regex-only results */ }
        // Clear page content to free memory
        delete enhanced._pages;
      }
      delete result._pages;

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

    // Get templates — prefer sector-scoped when possible
    const templates = this._getTemplates(wizard.organization_type);

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

      // Apply template governance config (domains + risk signals)
      if (wizard.selected_template && this.templateRegistry) {
        const tmpl = this.templateRegistry.getTemplate(wizard.selected_template);
        if (tmpl && tmpl.governance) {
          if (this.domainRegistry) this.domainRegistry.applyTemplate(tmpl);
          if (this.riskSignalRegistry) this.riskSignalRegistry.applyTemplate(tmpl);
        }
      }

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
      "organization_type",
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

  _getTemplates(sector) {
    // Use template registry if available
    if (this.templateRegistry) {
      const templates = sector
        ? this.templateRegistry.getTemplatesForSector(sector)
        : this.templateRegistry.listTemplates();
      if (templates.length) return templates;
    }

    // Fall back to DB templates
    const results = this.db.exec("SELECT * FROM agent_templates ORDER BY name");
    if (results.length) {
      const { columns, values } = results[0];
      const templates = values.map((row) => {
        const obj = {};
        columns.forEach((col, i) => { obj[col] = row[i]; });
        try { obj.config = JSON.parse(obj.config || "{}"); } catch { obj.config = {}; }
        return obj;
      });
      if (templates.length) return templates;
    }

    // Final fallback: hardcoded
    return this._getBuiltinTemplates();
  }

  _getBuiltinTemplates() {
    return [
      { id: "municipal-full", name: "Municipal Government (Full)", category: "municipal", sector: "government",
        departments: ["HR", "Finance", "Legal", "Public Health", "Public Safety", "Parks", "Building", "Utilities", "IT", "Communications"],
        governance: { compliance: ["FOIA", "ADA"] },
        config: { type: "municipal", agents: [
          { domain: "HR" }, { domain: "Finance" }, { domain: "Legal" },
          { domain: "PublicHealth" }, { domain: "PublicSafety" }, { domain: "Parks" },
          { domain: "Building" }, { domain: "Utilities" }, { domain: "IT" },
          { domain: "Communications" },
        ]} },
      { id: "municipal-lite", name: "Municipal Government (Lite)", category: "municipal", sector: "government",
        departments: ["HR", "Finance", "Public Safety", "Building"],
        governance: { compliance: ["FOIA", "ADA"] },
        config: { type: "municipal", agents: [
          { domain: "HR" }, { domain: "Finance" }, { domain: "PublicSafety" },
          { domain: "Building" },
        ]} },
      { id: "enterprise", name: "Enterprise", category: "enterprise", sector: "technology",
        departments: ["HR", "Finance", "Legal", "IT"],
        governance: { compliance: [] },
        config: { type: "enterprise", agents: [
          { domain: "HR" }, { domain: "Finance" }, { domain: "Legal" }, { domain: "IT" },
        ]} },
      { id: "nonprofit", name: "Nonprofit Organization", category: "nonprofit", sector: "nonprofit",
        departments: ["General", "Finance", "Communications"],
        governance: { compliance: [] },
        config: { type: "nonprofit", agents: [
          { domain: "General" }, { domain: "Finance" }, { domain: "Communications" },
        ]} },
    ];
  }

  _scoreTemplateMatch(departments, template, orgType) {
    let score = 0.5;
    const evidence = [];

    // Sector/type match
    if (template.sector === orgType || template.config?.type === orgType || template.category === orgType) {
      score += 0.2;
      evidence.push(`Sector matches: ${orgType}`);
    }

    // Department coverage — compare discovered dept names vs template departments
    const templateDepts = new Set(
      (template.departments || (template.config?.agents || []).map((a) => a.domain))
        .map((d) => (typeof d === "string" ? d : d.domain || "").toLowerCase())
    );
    const orgDeptNames = new Set(departments.map((d) => (d.name || "").toLowerCase()));

    let overlap = 0;
    for (const d of orgDeptNames) {
      for (const td of templateDepts) {
        if (d.includes(td) || td.includes(d)) { overlap++; break; }
      }
    }

    if (overlap > 0) {
      const coverage = overlap / Math.max(orgDeptNames.size, 1);
      score += coverage * 0.3;
      evidence.push(`${overlap} department(s) match template`);
    }

    return {
      score: Math.min(score, 1.0),
      level: confidenceLevel(Math.min(score, 1.0)),
      reason: `Template match for ${orgType}`,
      evidence,
    };
  }

  _getModificationsNeeded(departments, template) {
    const templateDepts = new Set(
      (template.departments || (template.config?.agents || []).map((a) => a.domain))
        .map((d) => (typeof d === "string" ? d : d.domain || "").toLowerCase())
    );
    const orgDepts = new Set(departments.map((d) => (d.name || "").toLowerCase()));

    const mods = [];
    const missing = [...orgDepts].filter((d) => ![...templateDepts].some((td) => d.includes(td) || td.includes(d)));
    const extra = [...templateDepts].filter((td) => ![...orgDepts].some((d) => d.includes(td) || td.includes(d)));

    if (missing.length) mods.push(`Add departments: ${missing.join(", ")}`);
    if (extra.length) mods.push(`Remove unused: ${extra.join(", ")}`);

    return mods;
  }

  _inferDomain(name) {
    const lower = name.toLowerCase();
    const domainMap = {
      // Base domains
      HR: ["hr", "human resource", "personnel", "employee", "talent", "recruiting", "staffing"],
      Finance: ["finance", "budget", "treasury", "accounting", "billing", "payroll", "procurement"],
      Legal: ["legal", "law", "attorney", "counsel", "compliance officer", "regulatory"],
      Comms: ["communications", "media", "public affairs", "marketing", "social media", "pr"],
      DevOps: ["technology", "it", "information technology", "engineering", "devops", "infrastructure"],
      // Extended domains
      Healthcare: ["health", "medical", "clinical", "nursing", "pharmacy", "patient", "physician"],
      Education: ["academic", "student", "curriculum", "admissions", "registrar", "faculty", "library"],
      Safety: ["safety", "osha", "incident", "emergency", "fire", "hazard"],
      Operations: ["operations", "logistics", "warehouse", "inventory", "dispatch", "production", "maintenance", "supply chain"],
      CustomerService: ["customer service", "support", "help desk", "call center", "client services", "front desk"],
      Marketing: ["marketing", "advertising", "branding", "seo", "content", "promotions"],
      Compliance: ["compliance", "audit", "regulatory", "quality", "inspection"],
      ClinicalResearch: ["research", "clinical trial", "lab", "r&d"],
      RealEstate: ["property", "leasing", "real estate", "facilities", "maintenance"],
      Agriculture: ["farm", "crop", "livestock", "agriculture", "field operations"],
      // Government-specific
      PublicSafety: ["police", "public safety", "law enforcement"],
      PublicHealth: ["public health", "epidemiology", "clinic"],
      Parks: ["parks", "recreation", "community centers"],
      Building: ["building", "permit", "zoning", "planning", "code enforcement"],
      Utilities: ["water", "utilities", "electric", "sewer", "sanitation"],
    };

    for (const [domain, keywords] of Object.entries(domainMap)) {
      if (keywords.some((kw) => lower.includes(kw))) return domain;
    }
    return "General";
  }

  _inferCapabilities(name) {
    const lower = name.toLowerCase();

    if (lower.match(/hr|human|talent|recruit/)) return ["benefits", "policies", "onboarding", "leave", "recruiting"];
    if (lower.match(/finance|budget|accounting|billing/)) return ["budgets", "payments", "procurement", "reporting", "invoicing"];
    if (lower.match(/legal|counsel/)) return ["contracts", "compliance", "records", "policy review"];
    if (lower.match(/building|permit/)) return ["permits", "inspections", "zoning", "codes"];
    if (lower.match(/health|medical|clinical|nursing/)) return ["patient care", "scheduling", "records", "compliance"];
    if (lower.match(/police|public safety/)) return ["reports", "community programs", "statistics"];
    if (lower.match(/fire|emergency/)) return ["prevention", "inspections", "emergency info"];
    if (lower.match(/parks|recreation/)) return ["programs", "reservations", "events"];
    if (lower.match(/water|utilities/)) return ["billing", "service requests", "outages"];
    if (lower.match(/technology|it|engineering|devops/)) return ["support", "systems", "infrastructure", "development"];
    if (lower.match(/marketing|advertising|brand/)) return ["campaigns", "content", "analytics", "social media"];
    if (lower.match(/sales|business dev/)) return ["pipeline", "proposals", "client relations"];
    if (lower.match(/customer|support|help desk|front desk/)) return ["tickets", "resolution", "feedback", "escalation"];
    if (lower.match(/operations|logistics|warehouse/)) return ["scheduling", "inventory", "dispatch", "workflow"];
    if (lower.match(/compliance|audit|quality/)) return ["auditing", "reporting", "policy", "risk assessment"];
    if (lower.match(/research|r&d|lab/)) return ["studies", "data analysis", "publications", "protocols"];
    if (lower.match(/communications|media|pr/)) return ["press releases", "social media", "internal comms", "newsletters"];
    if (lower.match(/safety|osha/)) return ["inspections", "incident reports", "training", "compliance"];
    if (lower.match(/property|facilities|maintenance/)) return ["work orders", "inspections", "tenant relations", "scheduling"];

    return ["general inquiry", "information"];
  }
}

module.exports = { OnboardingWizard, STEPS };
