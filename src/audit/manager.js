const { v4: uuidv4 } = require("uuid");

class AuditManager {
  constructor(db, saveFn) {
    this.db = db;
    this.saveFn = saveFn;
  }

  logEvent(type, severity, userId, action, details = {}) {
    const id = uuidv4();
    this.db.run(
      `INSERT INTO audit_events
       (id, event_type, severity, user_id, user_department, agent_id, agent_name,
        action, details, pii_detected, guardrails_triggered, requires_review)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        type,
        severity || "info",
        userId || null,
        details.user_department || null,
        details.agent_id || null,
        details.agent_name || null,
        action,
        JSON.stringify(details),
        JSON.stringify(details.pii_detected || []),
        JSON.stringify(details.guardrails_triggered || []),
        details.requires_review ? 1 : 0,
      ]
    );
    if (this.saveFn) this.saveFn();
    return id;
  }

  getSummary(startDate, endDate) {
    const start = startDate || new Date(Date.now() - 30 * 86400000).toISOString();
    const end = endDate || new Date().toISOString();

    const result = { total: 0, byType: {}, bySeverity: {}, requiresReview: 0 };

    // Total count
    let stmt = this.db.prepare(
      `SELECT COUNT(*) as cnt FROM audit_events WHERE timestamp >= ? AND timestamp <= ?`
    );
    stmt.bind([start, end]);
    if (stmt.step()) result.total = stmt.getAsObject().cnt;
    stmt.free();

    // By type
    stmt = this.db.prepare(
      `SELECT event_type, COUNT(*) as cnt FROM audit_events
       WHERE timestamp >= ? AND timestamp <= ?
       GROUP BY event_type ORDER BY cnt DESC`
    );
    stmt.bind([start, end]);
    while (stmt.step()) {
      const row = stmt.getAsObject();
      result.byType[row.event_type] = row.cnt;
    }
    stmt.free();

    // By severity
    stmt = this.db.prepare(
      `SELECT severity, COUNT(*) as cnt FROM audit_events
       WHERE timestamp >= ? AND timestamp <= ?
       GROUP BY severity`
    );
    stmt.bind([start, end]);
    while (stmt.step()) {
      const row = stmt.getAsObject();
      result.bySeverity[row.severity] = row.cnt;
    }
    stmt.free();

    // Requires review
    stmt = this.db.prepare(
      `SELECT COUNT(*) as cnt FROM audit_events
       WHERE requires_review = 1 AND reviewed_by IS NULL
       AND timestamp >= ? AND timestamp <= ?`
    );
    stmt.bind([start, end]);
    if (stmt.step()) result.requiresReview = stmt.getAsObject().cnt;
    stmt.free();

    result.startDate = start;
    result.endDate = end;

    return result;
  }

  listEvents(filters = {}) {
    let sql = "SELECT * FROM audit_events WHERE 1=1";
    const params = [];

    if (filters.event_type) {
      sql += " AND event_type = ?";
      params.push(filters.event_type);
    }
    if (filters.severity) {
      sql += " AND severity = ?";
      params.push(filters.severity);
    }
    if (filters.user_id) {
      sql += " AND user_id = ?";
      params.push(filters.user_id);
    }
    if (filters.requires_review) {
      sql += " AND requires_review = 1 AND reviewed_by IS NULL";
    }
    if (filters.since) {
      sql += " AND timestamp >= ?";
      params.push(filters.since);
    }

    sql += " ORDER BY timestamp DESC";
    sql += " LIMIT ?";
    params.push(parseInt(filters.limit, 10) || 100);
    sql += " OFFSET ?";
    params.push(parseInt(filters.offset, 10) || 0);

    const stmt = this.db.prepare(sql);
    if (params.length) stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      const obj = stmt.getAsObject();
      for (const col of ["details", "pii_detected", "guardrails_triggered"]) {
        if (obj[col]) {
          try { obj[col] = JSON.parse(obj[col]); } catch { obj[col] = {}; }
        }
      }
      results.push(obj);
    }
    stmt.free();
    return results;
  }

  markReviewed(eventId, reviewerId) {
    this.db.run(
      "UPDATE audit_events SET reviewed_by = ? WHERE id = ?",
      [reviewerId, eventId]
    );
    if (this.saveFn) this.saveFn();
    return { ok: true, event_id: eventId, reviewed_by: reviewerId };
  }

}

module.exports = { AuditManager };
