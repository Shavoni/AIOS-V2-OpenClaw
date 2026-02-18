const { v4: uuidv4 } = require("uuid");

class HITLManager {
  constructor(db, saveFn) {
    this.db = db;
    this.saveFn = saveFn;
  }

  createApproval(request) {
    const id = uuidv4();
    this.db.run(
      `INSERT INTO approval_requests
       (id, status, hitl_mode, priority, user_id, user_department, agent_id, agent_name,
        original_query, proposed_response, risk_signals, guardrails_triggered, escalation_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        "pending",
        request.hitl_mode || request.hitlMode || "DRAFT",
        request.priority || "medium",
        request.user_id || null,
        request.user_department || null,
        request.agent_id || null,
        request.agent_name || null,
        request.original_query || "",
        request.proposed_response || "",
        JSON.stringify(request.risk_signals || []),
        JSON.stringify(request.guardrails_triggered || []),
        request.escalation_reason || null,
      ]
    );
    if (this.saveFn) this.saveFn();
    return this.getApproval(id);
  }

  getApproval(id) {
    const stmt = this.db.prepare("SELECT * FROM approval_requests WHERE id = ?");
    stmt.bind([id]);
    let approval = null;
    if (stmt.step()) {
      approval = stmt.getAsObject();
      approval.risk_signals = JSON.parse(approval.risk_signals || "[]");
      approval.guardrails_triggered = JSON.parse(approval.guardrails_triggered || "[]");
    }
    stmt.free();
    return approval;
  }

  listPending(filters = {}) {
    let sql = "SELECT * FROM approval_requests WHERE status = 'pending'";
    const params = [];

    if (filters.hitl_mode) {
      sql += " AND hitl_mode = ?";
      params.push(filters.hitl_mode);
    }
    if (filters.agent_id) {
      sql += " AND agent_id = ?";
      params.push(filters.agent_id);
    }
    if (filters.priority) {
      sql += " AND priority = ?";
      params.push(filters.priority);
    }

    sql += " ORDER BY created_at DESC";

    if (filters.limit) {
      sql += " LIMIT ?";
      params.push(filters.limit);
    }

    const stmt = this.db.prepare(sql);
    if (params.length) stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      row.risk_signals = JSON.parse(row.risk_signals || "[]");
      row.guardrails_triggered = JSON.parse(row.guardrails_triggered || "[]");
      results.push(row);
    }
    stmt.free();
    return results;
  }

  listAll(filters = {}) {
    let sql = "SELECT * FROM approval_requests WHERE 1=1";
    const params = [];

    if (filters.status) {
      sql += " AND status = ?";
      params.push(filters.status);
    }
    if (filters.hitl_mode) {
      sql += " AND hitl_mode = ?";
      params.push(filters.hitl_mode);
    }

    sql += " ORDER BY created_at DESC";
    sql += " LIMIT ?";
    params.push(parseInt(filters.limit, 10) || 100);

    const stmt = this.db.prepare(sql);
    if (params.length) stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      row.risk_signals = JSON.parse(row.risk_signals || "[]");
      row.guardrails_triggered = JSON.parse(row.guardrails_triggered || "[]");
      results.push(row);
    }
    stmt.free();
    return results;
  }

  approve(id, reviewerId, notes, modifiedResponse) {
    const now = new Date().toISOString();
    const updates = [now, reviewerId || null, notes || null, "approved"];

    let sql = `UPDATE approval_requests SET resolved_at = ?, resolved_by = ?, reviewer_notes = ?, status = ?`;
    if (modifiedResponse) {
      sql += ", proposed_response = ?";
      updates.push(modifiedResponse);
    }
    sql += " WHERE id = ?";
    updates.push(id);

    this.db.run(sql, updates);
    if (this.saveFn) this.saveFn();
    return this.getApproval(id);
  }

  reject(id, reviewerId, reason) {
    const now = new Date().toISOString();
    this.db.run(
      `UPDATE approval_requests SET resolved_at = ?, resolved_by = ?, reviewer_notes = ?, status = ? WHERE id = ?`,
      [now, reviewerId || null, reason || null, "rejected", id]
    );
    if (this.saveFn) this.saveFn();
    return this.getApproval(id);
  }

  getQueueSummary() {
    const results = { pending: 0, approved: 0, rejected: 0, byMode: {}, byPriority: {} };

    // Status counts in a single query
    const r = this.db.exec(
      `SELECT status, COUNT(*) as cnt FROM approval_requests GROUP BY status`
    );
    if (r.length) {
      for (const row of r[0].values) {
        if (row[0] === "pending") results.pending = row[1];
        else if (row[0] === "approved") results.approved = row[1];
        else if (row[0] === "rejected") results.rejected = row[1];
      }
    }

    // Pending breakdowns by mode and priority in a single query
    const stmt = this.db.prepare(
      `SELECT hitl_mode, priority, COUNT(*) as cnt
       FROM approval_requests WHERE status = 'pending'
       GROUP BY hitl_mode, priority`
    );
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.byMode[row.hitl_mode] = (results.byMode[row.hitl_mode] || 0) + row.cnt;
      results.byPriority[row.priority] = (results.byPriority[row.priority] || 0) + row.cnt;
    }
    stmt.free();

    return results;
  }
}

module.exports = { HITLManager };
