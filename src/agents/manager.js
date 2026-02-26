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
      `INSERT INTO agents (id, name, title, domain, description, system_prompt, capabilities, guardrails, status, is_router, escalates_to, logo_url, brand_color, brand_tagline, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        config.name || "Unnamed Agent",
        config.title || "",
        config.domain || "General",
        config.description || "",
        config.system_prompt || "",
        JSON.stringify(config.capabilities || []),
        JSON.stringify(config.guardrails || []),
        config.status || "pending",
        config.is_router ? 1 : 0,
        config.escalates_to || null,
        config.logo_url || "",
        config.brand_color || "",
        config.brand_tagline || "",
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
      "approved_by", "approved_at", "rejection_reason",
      "logo_url", "brand_color", "brand_tagline",
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

  deleteAgent(id, { vectorStore, rag } = {}) {
    // Clean up RAG in-memory index and vector embeddings before cascade delete
    if (vectorStore) vectorStore.deleteByAgent(id);
    if (rag && rag.search && rag.search._index) {
      rag.search._index.delete(id);
    }
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

  approveAgent(id, approvedBy) {
    const agent = this.getAgent(id);
    if (!agent) return null;
    if (agent.status !== "pending") return null;
    return this.updateAgent(id, {
      status: "active",
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
    });
  }

  rejectAgent(id, approvedBy, reason = "") {
    const agent = this.getAgent(id);
    if (!agent) return null;
    if (agent.status !== "pending") return null;
    return this.updateAgent(id, {
      status: "rejected",
      approved_by: approvedBy,
      rejection_reason: reason,
    });
  }

  getPendingAgents() {
    const results = this.db.exec(
      "SELECT * FROM agents WHERE status = 'pending' ORDER BY created_at ASC"
    );
    if (!results.length) return [];
    return this._rowsToObjects(results[0]);
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
    const now = new Date().toISOString();
    this.db.run(
      `INSERT INTO knowledge_documents (id, agent_id, filename, file_type, file_size, chunk_count, status, added_by, source_type, source_url, research_job_id, priority, language, uploaded_at, updated_at, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, agentId, doc.filename, doc.file_type || "", doc.file_size || 0, doc.chunk_count || 0,
        doc.status || "active", doc.added_by || "user", doc.source_type || "manual_entry",
        doc.source_url || null, doc.research_job_id || null, doc.priority || 50,
        doc.language || null, now, now, JSON.stringify(doc.metadata || {}),
      ]
    );
    if (this.saveFn) this.saveFn();
    return { id, ...doc };
  }

  listKnowledgeDocuments(agentId, { includeDeleted = false } = {}) {
    const sql = includeDeleted
      ? "SELECT * FROM knowledge_documents WHERE agent_id = ? ORDER BY priority DESC, uploaded_at DESC"
      : "SELECT * FROM knowledge_documents WHERE agent_id = ? AND is_deleted = 0 ORDER BY priority DESC, uploaded_at DESC";
    const stmt = this.db.prepare(sql);
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

  deleteKnowledgeDocument(id, { rag, agentId } = {}) {
    if (rag && agentId) {
      rag.removeDocument(agentId, id);
    }
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

  listAllAutoRefreshSources() {
    const stmt = this.db.prepare(
      "SELECT * FROM web_sources WHERE auto_refresh = 1 ORDER BY last_refreshed ASC"
    );
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

  // ─── Enhanced KB Methods ─────────────────────────────────────

  getKnowledgeDocument(id) {
    const stmt = this.db.prepare("SELECT * FROM knowledge_documents WHERE id = ?");
    stmt.bind([id]);
    let doc = null;
    if (stmt.step()) {
      doc = stmt.getAsObject();
      doc.metadata = JSON.parse(doc.metadata || "{}");
    }
    stmt.free();
    return doc;
  }

  updateKnowledgeDocument(id, updates) {
    const doc = this.getKnowledgeDocument(id);
    if (!doc) return null;

    const ALLOWED = new Set([
      "filename", "file_type", "file_size", "chunk_count", "status",
      "added_by", "source_type", "source_url", "research_job_id",
      "priority", "language", "metadata",
    ]);

    const fields = [];
    const values = [];
    for (const [key, val] of Object.entries(updates)) {
      if (!ALLOWED.has(key)) continue;
      fields.push(`${key} = ?`);
      values.push(key === "metadata" ? JSON.stringify(val) : val);
    }

    fields.push("updated_at = ?");
    values.push(new Date().toISOString());
    values.push(id);

    if (fields.length > 1) {
      this.db.run(`UPDATE knowledge_documents SET ${fields.join(", ")} WHERE id = ?`, values);
      if (this.saveFn) this.saveFn();
    }

    return this.getKnowledgeDocument(id);
  }

  softDeleteDocument(id) {
    const doc = this.getKnowledgeDocument(id);
    if (!doc) return null;

    const now = new Date().toISOString();
    this.db.run(
      "UPDATE knowledge_documents SET is_deleted = 1, deleted_at = ?, updated_at = ? WHERE id = ?",
      [now, now, id]
    );
    if (this.saveFn) this.saveFn();
    return this.getKnowledgeDocument(id);
  }

  restoreDocument(id) {
    const now = new Date().toISOString();
    this.db.run(
      "UPDATE knowledge_documents SET is_deleted = 0, deleted_at = NULL, updated_at = ? WHERE id = ?",
      [now, id]
    );
    if (this.saveFn) this.saveFn();
    return this.getKnowledgeDocument(id);
  }

  hardDeleteDocument(id, { rag, agentId } = {}) {
    if (rag && agentId) rag.removeDocument(agentId, id);
    this.db.run("DELETE FROM knowledge_documents WHERE id = ?", [id]);
    if (this.saveFn) this.saveFn();
    return { ok: true };
  }

  batchDeleteDocuments(ids) {
    const now = new Date().toISOString();
    let deleted = 0;
    for (const id of ids) {
      this.db.run(
        "UPDATE knowledge_documents SET is_deleted = 1, deleted_at = ?, updated_at = ? WHERE id = ?",
        [now, now, id]
      );
      deleted++;
    }
    if (this.saveFn) this.saveFn();
    return { deleted };
  }

  updateWebSource(id, updates) {
    // Check existence
    const stmt = this.db.prepare("SELECT * FROM web_sources WHERE id = ?");
    stmt.bind([id]);
    let source = null;
    if (stmt.step()) source = stmt.getAsObject();
    stmt.free();
    if (!source) return null;

    const ALLOWED = new Set([
      "url", "name", "description", "refresh_interval_hours", "auto_refresh",
      "last_refreshed", "chunk_count",
    ]);

    const fields = [];
    const values = [];
    for (const [key, val] of Object.entries(updates)) {
      if (!ALLOWED.has(key)) continue;
      fields.push(`${key} = ?`);
      values.push(key === "auto_refresh" ? (val ? 1 : 0) : val);
    }

    if (fields.length === 0) return source;
    values.push(id);

    this.db.run(`UPDATE web_sources SET ${fields.join(", ")} WHERE id = ?`, values);
    if (this.saveFn) this.saveFn();

    // Re-fetch
    const refetch = this.db.prepare("SELECT * FROM web_sources WHERE id = ?");
    refetch.bind([id]);
    let updated = null;
    if (refetch.step()) updated = refetch.getAsObject();
    refetch.free();
    return updated;
  }

  getKBStats(agentId) {
    // Document count and total size (active only)
    const docResults = this.db.exec(
      `SELECT COUNT(*) as cnt, COALESCE(SUM(file_size), 0) as total_size
       FROM knowledge_documents WHERE agent_id = '${agentId}' AND is_deleted = 0`
    );
    const docCount = docResults.length ? docResults[0].values[0][0] : 0;
    const totalSize = docResults.length ? docResults[0].values[0][1] : 0;

    // Web source count
    const srcResults = this.db.exec(
      `SELECT COUNT(*) as cnt FROM web_sources WHERE agent_id = '${agentId}'`
    );
    const srcCount = srcResults.length ? srcResults[0].values[0][0] : 0;

    return {
      documentCount: docCount,
      webSourceCount: srcCount,
      totalSizeBytes: totalSize,
    };
  }

  populateKBFromResearch(agentId, { jobId, sources, threshold = 0.65 }) {
    let added = 0;
    let skipped = 0;

    for (const source of sources) {
      if ((source.composite || 0) < threshold) {
        skipped++;
        continue;
      }

      this.addKnowledgeDocument(agentId, {
        filename: source.title || source.url || "research-source",
        file_type: "txt",
        file_size: (source.text || "").length,
        source_type: "deep_research",
        source_url: source.url || null,
        added_by: "deep_research",
        research_job_id: jobId,
        priority: Math.round((source.composite || 0.5) * 100),
        metadata: {
          originalScore: source.composite,
          retrievalMethod: source.retrievalMethod,
        },
      });
      added++;
    }

    return { added, skipped };
  }

  provisionKBFromWebSources(agentId, webSources) {
    let sourcesAdded = 0;
    for (const src of webSources) {
      this.addWebSource(agentId, {
        url: src.url,
        name: src.name || "",
        description: src.description || "",
      });
      sourcesAdded++;
    }
    return { sourcesAdded };
  }

  getKBCoverageAnalysis(agentId) {
    const agent = this.getAgent(agentId);
    if (!agent) return null;

    const docs = this.listKnowledgeDocuments(agentId);
    const sources = this.listWebSources(agentId);
    const capabilities = agent.capabilities || [];

    // Simple heuristic coverage: documents per capability
    const docFilenames = docs.map(d => (d.filename || "").toLowerCase()).join(" ");
    let coveredCaps = 0;
    const gaps = [];

    for (const cap of capabilities) {
      if (docFilenames.includes(cap.toLowerCase().split(" ")[0])) {
        coveredCaps++;
      } else {
        gaps.push(cap);
      }
    }

    const capCount = Math.max(capabilities.length, 1);
    const docScore = Math.min(docs.length / (capCount * 2), 0.5);
    const capScore = (coveredCaps / capCount) * 0.5;
    const coverageScore = Math.min(docScore + capScore, 1.0);

    const gapSummary = gaps.length > 0
      ? `Missing KB coverage for: ${gaps.join(", ")}`
      : "KB covers all defined capabilities";

    return {
      coverageScore: parseFloat(coverageScore.toFixed(2)),
      gapSummary,
      documentCount: docs.length,
      webSourceCount: sources.length,
      capabilities: capabilities.length,
      coveredCapabilities: coveredCaps,
      gaps,
    };
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
