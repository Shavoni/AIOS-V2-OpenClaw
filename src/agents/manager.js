const { v4: uuidv4 } = require("uuid");

class AgentManagerService {
  constructor(db, saveFn) {
    this.db = db;
    this.saveFn = saveFn;
  }

  listAgents() {
    const results = this.db.exec("SELECT * FROM agents ORDER BY created_at DESC");
    if (!results.length) return [];
    return this._rowsToObjects(results[0]);
  }

  getAgent(id) {
    const stmt = this.db.prepare("SELECT * FROM agents WHERE id = ?");
    stmt.bind([id]);
    let agent = null;
    if (stmt.step()) {
      agent = stmt.getAsObject();
      agent.capabilities = JSON.parse(agent.capabilities || "[]");
      agent.guardrails = JSON.parse(agent.guardrails || "[]");
    }
    stmt.free();
    return agent;
  }

  createAgent(config) {
    const id = config.id || uuidv4();
    const now = new Date().toISOString();
    this.db.run(
      `INSERT INTO agents (id, name, title, domain, description, system_prompt, capabilities, guardrails, status, is_router, escalates_to, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        config.name || "Unnamed Agent",
        config.title || "",
        config.domain || "General",
        config.description || "",
        config.system_prompt || "",
        JSON.stringify(config.capabilities || []),
        JSON.stringify(config.guardrails || []),
        config.status || "active",
        config.is_router ? 1 : 0,
        config.escalates_to || null,
        now,
        now,
      ]
    );
    if (this.saveFn) this.saveFn();
    return this.getAgent(id);
  }

  updateAgent(id, updates) {
    const agent = this.getAgent(id);
    if (!agent) return null;

    // Column allowlist prevents SQL injection via dynamic column names
    const ALLOWED_COLUMNS = new Set([
      "name", "title", "domain", "description", "system_prompt",
      "capabilities", "guardrails", "status", "is_router", "escalates_to",
    ]);

    const fields = [];
    const values = [];

    for (const [key, val] of Object.entries(updates)) {
      if (!ALLOWED_COLUMNS.has(key)) continue;
      if (key === "capabilities" || key === "guardrails") {
        fields.push(`${key} = ?`);
        values.push(JSON.stringify(val));
      } else if (key === "is_router") {
        fields.push(`${key} = ?`);
        values.push(val ? 1 : 0);
      } else {
        fields.push(`${key} = ?`);
        values.push(val);
      }
    }

    fields.push("updated_at = ?");
    values.push(new Date().toISOString());
    values.push(id);

    if (fields.length > 1) {
      this.db.run(`UPDATE agents SET ${fields.join(", ")} WHERE id = ?`, values);
      if (this.saveFn) this.saveFn();
    }

    return this.getAgent(id);
  }

  deleteAgent(id) {
    this.db.run("DELETE FROM agents WHERE id = ?", [id]);
    if (this.saveFn) this.saveFn();
    return { ok: true };
  }

  enableAgent(id) {
    return this.updateAgent(id, { status: "active" });
  }

  disableAgent(id) {
    return this.updateAgent(id, { status: "disabled" });
  }

  getActiveAgents() {
    const results = this.db.exec(
      "SELECT * FROM agents WHERE status = 'active' ORDER BY name"
    );
    if (!results.length) return [];
    return this._rowsToObjects(results[0]);
  }

  regenerateConcierge() {
    const agents = this.getActiveAgents().filter((a) => !a.is_router);
    const routerPrompt = this._buildConciergePrompt(agents);

    // Find or create router agent
    const results = this.db.exec(
      "SELECT * FROM agents WHERE is_router = 1 LIMIT 1"
    );
    if (results.length && results[0].values.length) {
      const router = this._rowsToObjects(results[0])[0];
      return this.updateAgent(router.id, { system_prompt: routerPrompt });
    }

    return this.createAgent({
      name: "Concierge",
      title: "Intelligent Router",
      domain: "Routing",
      description: "Routes queries to the most appropriate specialist agent",
      system_prompt: routerPrompt,
      is_router: true,
      status: "active",
    });
  }

  routeQuery(query, classifier) {
    const agents = this.getActiveAgents().filter((a) => !a.is_router);
    if (!agents.length) return { agent: null, reason: "No active agents" };

    const lowerQuery = query.toLowerCase();

    // Use classifier intent if available for domain-level matching
    let intentDomain = null;
    if (classifier && typeof classifier.classify === "function") {
      try {
        const intent = classifier.classify(query);
        intentDomain = (intent.domain || intent.label || "").toLowerCase();
      } catch { /* fall through to keyword matching */ }
    }

    let bestMatch = null;
    let bestScore = 0;
    let bestReason = "";

    for (const agent of agents) {
      let score = 0;
      let reason = "";
      const domain = (agent.domain || "").toLowerCase();
      const desc = (agent.description || "").toLowerCase();
      const name = (agent.name || "").toLowerCase();
      const caps = (agent.capabilities || []).map((c) => c.toLowerCase());

      // Classifier-based domain match (highest signal)
      if (intentDomain && domain && intentDomain === domain) {
        score += 5;
        reason = `Intent classification: ${intentDomain}`;
      }

      // Keyword-based matching
      if (lowerQuery.includes(domain) && domain.length > 1) {
        score += 3;
        if (!reason) reason = `Domain keyword: ${domain}`;
      }
      if (lowerQuery.includes(name) && name.length > 1) {
        score += 2;
        if (!reason) reason = `Agent name match: ${name}`;
      }
      for (const cap of caps) {
        if (cap.length > 2 && lowerQuery.includes(cap)) {
          score += 1.5;
          if (!reason) reason = `Capability match: ${cap}`;
        }
      }

      // Description word overlap
      const descWords = desc.split(/\s+/).filter(w => w.length > 4);
      let wordHits = 0;
      for (const word of descWords) {
        if (lowerQuery.includes(word)) wordHits++;
      }
      if (wordHits > 0) {
        score += wordHits * 0.5;
        if (!reason) reason = `Description relevance (${wordHits} terms)`;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = agent;
        bestReason = reason;
      }
    }

    if (bestMatch && bestScore > 0) {
      return {
        agent: bestMatch,
        score: bestScore,
        reason: bestReason,
        confidence: Math.min(bestScore / 8, 1).toFixed(2),
      };
    }

    // Fallback to first active agent
    return { agent: agents[0], score: 0, reason: "Default fallback", confidence: "0.00" };
  }

  // Knowledge document management
  addKnowledgeDocument(agentId, doc) {
    const id = uuidv4();
    this.db.run(
      `INSERT INTO knowledge_documents (id, agent_id, filename, file_type, file_size, chunk_count, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, agentId, doc.filename, doc.file_type || "", doc.file_size || 0, doc.chunk_count || 0, JSON.stringify(doc.metadata || {})]
    );
    if (this.saveFn) this.saveFn();
    return { id, ...doc };
  }

  listKnowledgeDocuments(agentId) {
    const stmt = this.db.prepare(
      "SELECT * FROM knowledge_documents WHERE agent_id = ? ORDER BY uploaded_at DESC"
    );
    stmt.bind([agentId]);
    const docs = [];
    while (stmt.step()) {
      const doc = stmt.getAsObject();
      doc.metadata = JSON.parse(doc.metadata || "{}");
      docs.push(doc);
    }
    stmt.free();
    return docs;
  }

  deleteKnowledgeDocument(id) {
    this.db.run("DELETE FROM knowledge_documents WHERE id = ?", [id]);
    if (this.saveFn) this.saveFn();
    return { ok: true };
  }

  // Web source management
  addWebSource(agentId, source) {
    const id = uuidv4();
    this.db.run(
      `INSERT INTO web_sources (id, agent_id, url, name, description, refresh_interval_hours, auto_refresh)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, agentId, source.url, source.name || "", source.description || "", source.refresh_interval_hours || 24, source.auto_refresh ? 1 : 0]
    );
    if (this.saveFn) this.saveFn();
    return { id, ...source };
  }

  listWebSources(agentId) {
    const stmt = this.db.prepare(
      "SELECT * FROM web_sources WHERE agent_id = ? ORDER BY created_at DESC"
    );
    stmt.bind([agentId]);
    const sources = [];
    while (stmt.step()) sources.push(stmt.getAsObject());
    stmt.free();
    return sources;
  }

  deleteWebSource(id) {
    this.db.run("DELETE FROM web_sources WHERE id = ?", [id]);
    if (this.saveFn) this.saveFn();
    return { ok: true };
  }

  _buildConciergePrompt(agents) {
    const agentList = agents
      .map((a) => `- **${a.name}** (${a.domain}): ${a.description}`)
      .join("\n");

    return `You are the Concierge, an intelligent router that directs user queries to the most appropriate specialist agent.

Available Agents:
${agentList || "No specialist agents configured."}

When a user sends a message:
1. Analyze the intent and domain of the query
2. Select the most appropriate agent based on domain expertise
3. If no specialist matches, handle the query directly
4. Always explain which agent you're routing to and why`;
  }

  _rowsToObjects(result) {
    const { columns, values } = result;
    return values.map((row) => {
      const obj = {};
      columns.forEach((col, i) => {
        if (["capabilities", "guardrails", "metadata"].includes(col)) {
          try { obj[col] = JSON.parse(row[i] || "[]"); } catch { obj[col] = []; }
        } else {
          obj[col] = row[i];
        }
      });
      return obj;
    });
  }
}

module.exports = { AgentManagerService };
