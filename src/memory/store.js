const { v4: uuidv4 } = require("uuid");

class MessageStore {
  constructor(db, saveFn) {
    this.db = db;
    this.saveFn = saveFn || (() => {});
  }

  createSession(title, profile) {
    const id = uuidv4();
    this.db.run("INSERT INTO sessions (id, title, profile) VALUES (?, ?, ?)", [id, title, profile || "main"]);
    this.saveFn();
    return { id, title, profile: profile || "main" };
  }

  listSessions(limit = 50) {
    const stmt = this.db.prepare("SELECT id, title, profile, created_at, updated_at FROM sessions ORDER BY updated_at DESC LIMIT ?");
    stmt.bind([limit]);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }

  deleteSession(sessionId) {
    // Delete messages first to avoid orphans (FK may not cascade with sql.js)
    this.db.run("DELETE FROM messages WHERE session_id = ?", [sessionId]);
    this.db.run("DELETE FROM audit_log WHERE session_id = ?", [sessionId]);
    this.db.run("DELETE FROM sessions WHERE id = ?", [sessionId]);
    this.saveFn();
  }

  addMessage(sessionId, role, content, metadata = {}) {
    // Auto-create session if it doesn't exist (frontend generates IDs client-side)
    this._ensureSession(sessionId);
    this.db.run(
      "INSERT INTO messages (session_id, role, content, metadata) VALUES (?, ?, ?, ?)",
      [sessionId, role, content, JSON.stringify(metadata)]
    );
    this.db.run("UPDATE sessions SET updated_at = datetime('now') WHERE id = ?", [sessionId]);
    this.saveFn();
  }

  _ensureSession(sessionId) {
    const stmt = this.db.prepare("SELECT id FROM sessions WHERE id = ?");
    stmt.bind([sessionId]);
    const exists = stmt.step();
    stmt.free();
    if (!exists) {
      this.db.run("INSERT INTO sessions (id, title, profile) VALUES (?, ?, ?)", [sessionId, "New Chat", "main"]);
    }
  }

  getMessages(sessionId, limit = 100) {
    const stmt = this.db.prepare(
      "SELECT id, role, content, metadata, created_at FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ?"
    );
    stmt.bind([sessionId, limit]);
    const results = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      try { row.metadata = JSON.parse(row.metadata); } catch (_) {}
      results.push(row);
    }
    stmt.free();
    return results;
  }

  getRecentMessages(sessionId, tokenBudget = 8000) {
    const stmt = this.db.prepare(
      "SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT 200"
    );
    stmt.bind([sessionId]);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();

    let tokens = 0;
    const selected = [];
    for (const row of rows) {
      const est = Math.ceil(row.content.length / 4);
      if (tokens + est > tokenBudget) break;
      tokens += est;
      selected.unshift({ role: row.role, content: row.content });
    }
    return selected;
  }

  addAuditLog(entry) {
    this.db.run(
      "INSERT INTO audit_log (session_id, action, intent_domain, risk_signals, hitl_mode, provider, model) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        entry.sessionId,
        entry.action,
        entry.intentDomain,
        JSON.stringify(entry.riskSignals || []),
        entry.hitlMode,
        entry.provider,
        entry.model,
      ]
    );
    this.saveFn();
  }
}

module.exports = { MessageStore };
