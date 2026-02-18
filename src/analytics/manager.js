const { v4: uuidv4 } = require("uuid");

class AnalyticsManager {
  constructor(db, saveFn) {
    this.db = db;
    this.saveFn = saveFn;
  }

  recordQuery(event) {
    const id = uuidv4();
    this.db.run(
      `INSERT INTO query_events
       (id, user_id, department, agent_id, agent_name, query_text, response_text,
        latency_ms, tokens_in, tokens_out, cost_usd, hitl_mode,
        was_escalated, was_approved, guardrails_triggered, success, error_message, session_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        event.user_id || null,
        event.department || null,
        event.agent_id || null,
        event.agent_name || null,
        event.query_text || "",
        event.response_text || "",
        event.latency_ms || 0,
        event.tokens_in || 0,
        event.tokens_out || 0,
        event.cost_usd || 0,
        event.hitl_mode || "INFORM",
        event.was_escalated ? 1 : 0,
        event.was_approved ? 1 : 0,
        JSON.stringify(event.guardrails_triggered || []),
        event.success !== false ? 1 : 0,
        event.error_message || null,
        event.session_id || null,
      ]
    );
    if (this.saveFn) this.saveFn();
    return id;
  }

  getSummary(days = 30) {
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const result = {};

    // Total queries
    let stmt = this.db.prepare(
      `SELECT COUNT(*) as total,
              COALESCE(SUM(tokens_in), 0) as total_tokens_in,
              COALESCE(SUM(tokens_out), 0) as total_tokens_out,
              COALESCE(SUM(cost_usd), 0) as total_cost,
              COALESCE(AVG(latency_ms), 0) as avg_latency,
              COALESCE(SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END), 0) as errors,
              COALESCE(SUM(CASE WHEN was_escalated = 1 THEN 1 ELSE 0 END), 0) as escalations
       FROM query_events WHERE timestamp >= ?`
    );
    stmt.bind([since]);

    if (stmt.step()) {
      const row = stmt.getAsObject();
      result.totalQueries = row.total;
      result.totalTokensIn = row.total_tokens_in;
      result.totalTokensOut = row.total_tokens_out;
      result.totalCost = Math.round(row.total_cost * 10000) / 10000;
      result.avgLatency = Math.round(row.avg_latency);
      result.errors = row.errors;
      result.escalations = row.escalations;
      result.successRate = result.totalQueries > 0
        ? Math.round(((result.totalQueries - result.errors) / result.totalQueries) * 100)
        : 100;
    }
    stmt.free();

    // By agent
    stmt = this.db.prepare(
      `SELECT agent_name, COUNT(*) as queries, COALESCE(AVG(latency_ms), 0) as avg_latency,
              COALESCE(SUM(cost_usd), 0) as cost
       FROM query_events WHERE timestamp >= ? AND agent_name IS NOT NULL
       GROUP BY agent_name ORDER BY queries DESC LIMIT 20`
    );
    stmt.bind([since]);
    result.byAgent = {};
    while (stmt.step()) {
      const row = stmt.getAsObject();
      result.byAgent[row.agent_name] = { queries: row.queries, avgLatency: Math.round(row.avg_latency), cost: Math.round(row.cost * 10000) / 10000 };
    }
    stmt.free();

    // By department
    stmt = this.db.prepare(
      `SELECT department, COUNT(*) as queries
       FROM query_events WHERE timestamp >= ? AND department IS NOT NULL
       GROUP BY department ORDER BY queries DESC`
    );
    stmt.bind([since]);
    result.byDepartment = {};
    while (stmt.step()) {
      const row = stmt.getAsObject();
      result.byDepartment[row.department] = row.queries;
    }
    stmt.free();

    result.days = days;
    result.since = since;

    return result;
  }

  getAgentMetrics(agentId, days = 30) {
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const stmt = this.db.prepare(
      `SELECT COUNT(*) as total,
              COALESCE(AVG(latency_ms), 0) as avg_latency,
              COALESCE(SUM(cost_usd), 0) as total_cost,
              COALESCE(SUM(tokens_in + tokens_out), 0) as total_tokens,
              COALESCE(SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END), 0) as errors
       FROM query_events WHERE agent_id = ? AND timestamp >= ?`
    );
    stmt.bind([agentId, since]);
    let metrics = {};
    if (stmt.step()) {
      const row = stmt.getAsObject();
      metrics = {
        totalQueries: row.total,
        avgLatency: Math.round(row.avg_latency),
        totalCost: Math.round(row.total_cost * 10000) / 10000,
        totalTokens: row.total_tokens,
        errors: row.errors,
      };
    }
    stmt.free();
    return metrics;
  }

  getEvents(filters = {}) {
    let sql = "SELECT * FROM query_events WHERE 1=1";
    const params = [];

    if (filters.agent_id) {
      sql += " AND agent_id = ?";
      params.push(filters.agent_id);
    }
    if (filters.user_id) {
      sql += " AND user_id = ?";
      params.push(filters.user_id);
    }
    if (filters.since) {
      sql += " AND timestamp >= ?";
      params.push(filters.since);
    }
    if (filters.hitl_mode) {
      sql += " AND hitl_mode = ?";
      params.push(filters.hitl_mode);
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
      const row = stmt.getAsObject();
      row.guardrails_triggered = JSON.parse(row.guardrails_triggered || "[]");
      results.push(row);
    }
    stmt.free();
    return results;
  }

  exportJSON(days = 30) {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const stmt = this.db.prepare(
      `SELECT * FROM query_events WHERE timestamp >= ? ORDER BY timestamp DESC`
    );
    stmt.bind([since]);
    const results = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      if (row.guardrails_triggered) {
        try { row.guardrails_triggered = JSON.parse(row.guardrails_triggered); } catch { row.guardrails_triggered = []; }
      }
      results.push(row);
    }
    stmt.free();
    return results;
  }

  exportCSV(days = 30) {
    const events = this.exportJSON(days);
    if (!events.length) return "";

    const headers = Object.keys(events[0]);
    const lines = [headers.join(",")];
    for (const event of events) {
      const values = headers.map((h) => {
        const v = event[h];
        if (v === null || v === undefined) return "";
        const str = String(v).replace(/"/g, '""');
        return str.includes(",") || str.includes('"') || str.includes("\n") ? `"${str}"` : str;
      });
      lines.push(values.join(","));
    }
    return lines.join("\n");
  }

}

module.exports = { AnalyticsManager };
