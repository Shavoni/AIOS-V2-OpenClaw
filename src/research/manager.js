/**
 * Deep Research Pipeline — Job Manager
 *
 * Manages research job lifecycle, results, and sources in SQLite.
 * Follows the Manager pattern: constructor(db, saveFn).
 */

const { v4: uuidv4 } = require("uuid");

class ResearchJobManager {
  constructor(db, saveFn) {
    this.db = db;
    this.saveFn = saveFn;
  }

  // ─── Job CRUD ──────────────────────────────────────────

  createJob({ userId, query, ttl = 86400, metadata = {}, agentId }) {
    const id = uuidv4();
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    const expiresAt = new Date(Date.now() + ttl * 1000)
      .toISOString()
      .replace("T", " ")
      .slice(0, 19);

    this.db.run(
      `INSERT INTO research_jobs (id, user_id, query, ttl, metadata, agent_id, created_at, updated_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId || null, query, ttl, JSON.stringify(metadata), agentId || null, now, now, expiresAt]
    );

    if (this.saveFn) this.saveFn();
    return this.getJob(id);
  }

  getJob(id) {
    const stmt = this.db.prepare("SELECT * FROM research_jobs WHERE id = ?");
    stmt.bind([id]);
    let job = null;
    if (stmt.step()) {
      job = this._parseJobRow(stmt.getAsObject());
    }
    stmt.free();
    return job;
  }

  listJobs({ userId, status, limit = 50 } = {}) {
    let sql = "SELECT * FROM research_jobs WHERE 1=1";
    const params = [];

    if (userId) {
      sql += " AND user_id = ?";
      params.push(userId);
    }
    if (status) {
      sql += " AND status = ?";
      params.push(status);
    }

    sql += " ORDER BY created_at DESC LIMIT ?";
    params.push(limit);

    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const jobs = [];
    while (stmt.step()) {
      jobs.push(this._parseJobRow(stmt.getAsObject()));
    }
    stmt.free();
    return jobs;
  }

  deleteJob(id) {
    this.db.run("DELETE FROM research_jobs WHERE id = ?", [id]);
    if (this.saveFn) this.saveFn();
  }

  // ─── Status Machine ────────────────────────────────────

  updateStatus(id, status, { errorMessage, resultId, confidenceScore } = {}) {
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    let sql = "UPDATE research_jobs SET status = ?, updated_at = ?";
    const params = [status, now];

    if (errorMessage !== undefined) {
      sql += ", error_message = ?";
      params.push(errorMessage);
    }
    if (resultId !== undefined) {
      sql += ", result_id = ?";
      params.push(resultId);
    }
    if (confidenceScore !== undefined) {
      sql += ", confidence_score = ?";
      params.push(confidenceScore);
    }

    sql += " WHERE id = ?";
    params.push(id);

    this.db.run(sql, params);
    if (this.saveFn) this.saveFn();
  }

  completeJob(id, { resultId, confidenceScore, sourceCount, hasContradictions }) {
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    this.db.run(
      `UPDATE research_jobs
       SET status = 'COMPLETED', result_id = ?, confidence_score = ?,
           source_count = ?, has_contradictions = ?,
           completed_at = ?, updated_at = ?
       WHERE id = ?`,
      [
        resultId || null,
        confidenceScore || 0,
        sourceCount || 0,
        hasContradictions ? 1 : 0,
        now,
        now,
        id,
      ]
    );
    if (this.saveFn) this.saveFn();
  }

  failJob(id, errorMessage) {
    this.updateStatus(id, "FAILED", { errorMessage });
  }

  expireJob(id) {
    this.updateStatus(id, "EXPIRED");
  }

  // ─── Stage Progress ────────────────────────────────────

  updateStageProgress(id, stage, progress) {
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    this.db.run(
      "UPDATE research_jobs SET current_stage = ?, stage_progress = ?, updated_at = ? WHERE id = ?",
      [stage, progress, now, id]
    );
    if (this.saveFn) this.saveFn();
  }

  setQueryDecomposition(id, subQuestions) {
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    this.db.run(
      "UPDATE research_jobs SET query_decomposition = ?, updated_at = ? WHERE id = ?",
      [JSON.stringify(subQuestions), now, id]
    );
    if (this.saveFn) this.saveFn();
  }

  // ─── Results ───────────────────────────────────────────

  saveResult({ jobId, synthesis = "", sources = [], claims = [], evidenceSet = [], tokenUsage = {} }) {
    const id = uuidv4();
    this.db.run(
      `INSERT INTO research_results (id, job_id, synthesis, sources, claims, evidence_set, token_usage)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        jobId,
        synthesis,
        JSON.stringify(sources),
        JSON.stringify(claims),
        JSON.stringify(evidenceSet),
        JSON.stringify(tokenUsage),
      ]
    );
    if (this.saveFn) this.saveFn();
    return id;
  }

  getResult(jobId) {
    const stmt = this.db.prepare("SELECT * FROM research_results WHERE job_id = ?");
    stmt.bind([jobId]);
    let result = null;
    if (stmt.step()) {
      const row = stmt.getAsObject();
      result = {
        ...row,
        sources: JSON.parse(row.sources || "[]"),
        claims: JSON.parse(row.claims || "[]"),
        evidence_set: JSON.parse(row.evidence_set || "[]"),
        token_usage: JSON.parse(row.token_usage || "{}"),
      };
    }
    stmt.free();
    return result;
  }

  // ─── Sources ───────────────────────────────────────────

  addSource({
    jobId,
    url = "",
    title = "",
    contentPreview = "",
    domainAuthority = 50,
    recencyScore = 0,
    relevanceScore = 0,
    credibilityTier = "UNVERIFIED",
    compositeScore = 0,
    retrievalMethod = "rag",
  }) {
    const id = uuidv4();
    this.db.run(
      `INSERT INTO research_sources
       (id, job_id, url, title, content_preview, domain_authority, recency_score,
        relevance_score, credibility_tier, composite_score, retrieval_method)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, jobId, url, title, contentPreview, domainAuthority,
        recencyScore, relevanceScore, credibilityTier, compositeScore, retrievalMethod,
      ]
    );
    if (this.saveFn) this.saveFn();
    return id;
  }

  getSourcesForJob(jobId) {
    const stmt = this.db.prepare(
      "SELECT * FROM research_sources WHERE job_id = ? ORDER BY composite_score DESC"
    );
    stmt.bind([jobId]);
    const sources = [];
    while (stmt.step()) {
      sources.push(stmt.getAsObject());
    }
    stmt.free();
    return sources;
  }

  // ─── Maintenance ───────────────────────────────────────

  getExpiredJobs() {
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    const stmt = this.db.prepare(
      `SELECT * FROM research_jobs
       WHERE expires_at < ? AND status NOT IN ('COMPLETED', 'FAILED', 'EXPIRED')`
    );
    stmt.bind([now]);
    const jobs = [];
    while (stmt.step()) {
      jobs.push(this._parseJobRow(stmt.getAsObject()));
    }
    stmt.free();
    return jobs;
  }

  getQueueSummary() {
    const result = this.db.exec(
      "SELECT status, COUNT(*) as count FROM research_jobs GROUP BY status"
    );
    const summary = { QUEUED: 0, PROCESSING: 0, SYNTHESIZING: 0, COMPLETED: 0, FAILED: 0, EXPIRED: 0, total: 0 };
    if (result.length > 0) {
      for (const row of result[0].values) {
        summary[row[0]] = row[1];
        summary.total += row[1];
      }
    }
    return summary;
  }

  // ─── Internal ──────────────────────────────────────────

  _parseJobRow(row) {
    return {
      ...row,
      query_decomposition: JSON.parse(row.query_decomposition || "[]"),
      metadata: JSON.parse(row.metadata || "{}"),
      has_contradictions: row.has_contradictions === 1,
    };
  }
}

module.exports = { ResearchJobManager };
