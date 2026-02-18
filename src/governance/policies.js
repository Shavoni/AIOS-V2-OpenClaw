const { v4: uuidv4 } = require("uuid");
const { HITL_MODES, higherMode } = require("./hitl");

const CONSTITUTIONAL_RULES = [
  {
    id: "no-external-posting",
    name: "No External Posting",
    description: "Never post externally without explicit human approval",
    tier: "constitutional",
    hitl_mode: "ESCALATE",
    is_immutable: true,
    check: (_intent, risk) => {
      if (risk.signals.includes("PUBLIC_STATEMENT")) {
        return { hitlMode: HITL_MODES.ESCALATE, reason: "External posting requires human approval" };
      }
      return null;
    },
  },
  {
    id: "pii-protection",
    name: "PII Protection",
    description: "Protect personally identifiable information",
    tier: "constitutional",
    hitl_mode: "DRAFT",
    is_immutable: true,
    check: (_intent, risk) => {
      if (risk.signals.includes("PII")) {
        return { hitlMode: HITL_MODES.DRAFT, localOnly: true, reason: "PII detected \u2014 using local model only" };
      }
      return null;
    },
  },
  {
    id: "legal-review",
    name: "Legal Review",
    description: "Legal content requires human review",
    tier: "constitutional",
    hitl_mode: "DRAFT",
    is_immutable: true,
    check: (intent, risk) => {
      if (intent.domain === "Legal" || risk.signals.includes("LEGAL_CONTRACT")) {
        return { hitlMode: HITL_MODES.DRAFT, reason: "Legal content requires review" };
      }
      return null;
    },
  },
  {
    id: "financial-safeguard",
    name: "Financial Safeguard",
    description: "Financial actions require escalation",
    tier: "constitutional",
    hitl_mode: "ESCALATE",
    is_immutable: true,
    check: (intent, risk) => {
      if (risk.signals.includes("FINANCIAL") && intent.domain === "Finance") {
        return { hitlMode: HITL_MODES.ESCALATE, reason: "Financial action requires explicit approval" };
      }
      return null;
    },
  },
];

class GovernanceEngine {
  constructor(rules, db, saveFn) {
    this.rules = rules || CONSTITUTIONAL_RULES;
    this.db = db || null;
    this.saveFn = saveFn || null;
    this.classifier = null;
    this.riskDetector = null;
    this.dynamicRules = [];
    this.prohibitedTopics = [];
  }

  loadRules() {
    if (!this.db) return;

    try {
      const results = this.db.exec(
        "SELECT * FROM policy_rules ORDER BY priority ASC"
      );
      if (results.length) {
        this.dynamicRules = results[0].values.map((row) => {
          const cols = results[0].columns;
          const obj = {};
          cols.forEach((c, i) => { obj[c] = row[i]; });
          return {
            id: obj.id,
            name: obj.name,
            description: obj.description,
            tier: obj.tier,
            hitl_mode: obj.hitl_mode,
            local_only: !!obj.local_only,
            is_immutable: !!obj.is_immutable,
            conditions: JSON.parse(obj.conditions || "{}"),
            check: this._buildCheckFunction(obj),
          };
        });
      }

      const topicResults = this.db.exec(
        "SELECT * FROM prohibited_topics ORDER BY created_at DESC"
      );
      if (topicResults.length) {
        this.prohibitedTopics = topicResults[0].values.map((row) => ({
          id: row[0], topic: row[1], scope: row[2], scope_id: row[3], created_at: row[4],
        }));
      }
    } catch (err) {
      console.warn("Failed to load dynamic rules:", err.message);
    }
  }

  evaluate(intent, risk) {
    let hitlMode = HITL_MODES.INFORM;
    let localOnly = false;
    const policyTriggers = [];
    const guardrails = [];
    let escalationReason = null;

    const allRules = [...this.rules, ...this.dynamicRules];

    for (const rule of allRules) {
      const result = rule.check(intent, risk);
      if (result) {
        hitlMode = higherMode(hitlMode, result.hitlMode);
        policyTriggers.push(rule.id);
        guardrails.push(rule.description);
        if (result.localOnly) localOnly = true;
        if (result.hitlMode === HITL_MODES.ESCALATE) {
          escalationReason = result.reason;
        }
      }
    }

    if (this.prohibitedTopics.length > 0) {
      const queryLower = (intent._originalQuery || "").toLowerCase();
      for (const topic of this.prohibitedTopics) {
        if (queryLower.includes(topic.topic.toLowerCase())) {
          hitlMode = HITL_MODES.ESCALATE;
          policyTriggers.push(`prohibited:${topic.topic}`);
          guardrails.push(`Prohibited topic: ${topic.topic}`);
          escalationReason = `Query touches prohibited topic: ${topic.topic}`;
        }
      }
    }

    return {
      hitlMode,
      approvalRequired: hitlMode !== HITL_MODES.INFORM,
      providerConstraints: { localOnly },
      policyTriggers,
      guardrails,
      escalationReason,
    };
  }

  listRules() {
    const constitutional = this.rules.map((r) => ({
      id: r.id,
      name: r.name || r.id,
      description: r.description,
      tier: r.tier || "constitutional",
      hitl_mode: r.hitl_mode || "INFORM",
      is_immutable: true,
      source: "constitutional",
    }));

    const dynamic = this.dynamicRules.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      tier: r.tier || "standard",
      hitl_mode: r.hitl_mode || "INFORM",
      local_only: r.local_only,
      is_immutable: !!r.is_immutable,
      conditions: r.conditions,
      source: "database",
    }));

    return [...constitutional, ...dynamic];
  }

  createRule(rule) {
    if (!this.db) throw new Error("Database not available");

    const id = rule.id || uuidv4();
    this.db.run(
      `INSERT INTO policy_rules
       (id, name, description, tier, conditions, hitl_mode, local_only, approval_required, escalation_reason, priority, is_immutable)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, rule.name || "Unnamed Rule", rule.description || "", rule.tier || "standard",
        JSON.stringify(rule.conditions || {}), rule.hitl_mode || "INFORM",
        rule.local_only ? 1 : 0, rule.approval_required ? 1 : 0,
        rule.escalation_reason || null, rule.priority || 50, 0,
      ]
    );

    this._saveVersion(`Created rule: ${rule.name}`);
    this.loadRules();
    if (this.saveFn) this.saveFn();
    return { id, ...rule };
  }

  updateRule(id, updates) {
    if (this.rules.some((r) => r.id === id)) {
      throw new Error("Cannot modify constitutional rules");
    }

    // Column allowlist prevents SQL injection via dynamic column names
    const ALLOWED_COLUMNS = new Set([
      "name", "description", "tier", "conditions", "hitl_mode",
      "local_only", "approval_required", "escalation_reason", "priority",
    ]);

    const fields = [];
    const values = [];
    for (const [key, val] of Object.entries(updates)) {
      if (!ALLOWED_COLUMNS.has(key)) continue;
      if (key === "conditions") {
        fields.push("conditions = ?");
        values.push(JSON.stringify(val));
      } else if (key === "local_only" || key === "approval_required") {
        fields.push(`${key} = ?`);
        values.push(val ? 1 : 0);
      } else {
        fields.push(`${key} = ?`);
        values.push(val);
      }
    }

    if (fields.length) {
      values.push(id);
      this.db.run(`UPDATE policy_rules SET ${fields.join(", ")} WHERE id = ?`, values);
      this._saveVersion(`Updated rule: ${id}`);
      this.loadRules();
      if (this.saveFn) this.saveFn();
    }
    return { id, ...updates };
  }

  deleteRule(id) {
    if (this.rules.some((r) => r.id === id)) {
      throw new Error("Cannot delete constitutional rules");
    }
    this.db.run("DELETE FROM policy_rules WHERE id = ? AND is_immutable = 0", [id]);
    this._saveVersion(`Deleted rule: ${id}`);
    this.loadRules();
    if (this.saveFn) this.saveFn();
  }

  listProhibitedTopics() {
    return this.prohibitedTopics;
  }

  addProhibitedTopic(topic, scope = "global", scopeId = null) {
    if (!this.db) throw new Error("Database not available");
    const id = uuidv4();
    this.db.run(
      "INSERT INTO prohibited_topics (id, topic, scope, scope_id) VALUES (?, ?, ?, ?)",
      [id, topic, scope, scopeId]
    );
    this.loadRules();
    if (this.saveFn) this.saveFn();
    return { id, topic, scope, scope_id: scopeId };
  }

  removeProhibitedTopic(id) {
    if (!this.db) return;
    this.db.run("DELETE FROM prohibited_topics WHERE id = ?", [id]);
    this.loadRules();
    if (this.saveFn) this.saveFn();
  }

  getVersions() {
    if (!this.db) return [];
    const results = this.db.exec(
      "SELECT * FROM governance_versions ORDER BY created_at DESC LIMIT 50"
    );
    if (!results.length) return [];
    return results[0].values.map((row) => ({
      id: row[0], description: row[1],
      rules_snapshot: JSON.parse(row[2] || "[]"),
      changed_by: row[3], created_at: row[4],
    }));
  }

  rollback(versionId) {
    if (!this.db) throw new Error("Database not available");

    const stmt = this.db.prepare("SELECT rules_snapshot FROM governance_versions WHERE id = ?");
    stmt.bind([versionId]);
    if (!stmt.step()) { stmt.free(); throw new Error("Version not found"); }
    const snapshot = JSON.parse(stmt.getAsObject().rules_snapshot || "[]");
    stmt.free();

    this.db.run("DELETE FROM policy_rules WHERE is_immutable = 0");
    for (const rule of snapshot) {
      if (rule.is_immutable) continue;
      this.db.run(
        `INSERT INTO policy_rules (id, name, description, tier, conditions, hitl_mode, local_only, approval_required, escalation_reason, priority, is_immutable)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [rule.id, rule.name, rule.description, rule.tier, JSON.stringify(rule.conditions || {}),
         rule.hitl_mode, rule.local_only ? 1 : 0, rule.approval_required ? 1 : 0,
         rule.escalation_reason, rule.priority || 50]
      );
    }

    this._saveVersion(`Rolled back to version: ${versionId}`);
    this.loadRules();
    if (this.saveFn) this.saveFn();
    return { ok: true, version: versionId, rulesRestored: snapshot.length };
  }

  _saveVersion(description, changedBy) {
    if (!this.db) return;
    const id = uuidv4();
    const snapshot = this.dynamicRules.map((r) => ({
      id: r.id, name: r.name, description: r.description, tier: r.tier,
      conditions: r.conditions, hitl_mode: r.hitl_mode, local_only: r.local_only, priority: r.priority,
    }));
    this.db.run(
      "INSERT INTO governance_versions (id, description, rules_snapshot, changed_by) VALUES (?, ?, ?, ?)",
      [id, description, JSON.stringify(snapshot), changedBy || null]
    );
  }

  _buildCheckFunction(ruleObj) {
    const conditions = JSON.parse(ruleObj.conditions || "{}");
    const hitlMode = ruleObj.hitl_mode || "INFORM";
    const localOnly = !!ruleObj.local_only;
    const reason = ruleObj.escalation_reason || ruleObj.description;

    return (intent, risk) => {
      let triggered = false;

      if (conditions.domain && intent.domain === conditions.domain) triggered = true;

      if (conditions.risk_signals && Array.isArray(conditions.risk_signals)) {
        for (const signal of conditions.risk_signals) {
          if (risk.signals.includes(signal)) { triggered = true; break; }
        }
      }

      if (conditions.keywords && Array.isArray(conditions.keywords)) {
        const query = (intent._originalQuery || "").toLowerCase();
        for (const kw of conditions.keywords) {
          if (query.includes(kw.toLowerCase())) { triggered = true; break; }
        }
      }

      if (conditions.min_confidence && intent.confidence < conditions.min_confidence) {
        triggered = true;
      }

      return triggered ? { hitlMode: HITL_MODES[hitlMode] || HITL_MODES.INFORM, localOnly, reason } : null;
    };
  }
}

module.exports = { GovernanceEngine, CONSTITUTIONAL_RULES };
