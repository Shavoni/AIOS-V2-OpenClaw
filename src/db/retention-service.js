const SETTINGS_KEY = 'retention_policy';

class RetentionService {
  constructor(db, markDirty) {
    this.db = db;
    this.markDirty = markDirty || (() => {});
  }

  getPolicy() {
    try {
      const stmt = this.db.prepare("SELECT value FROM system_settings WHERE key = ?");
      stmt.bind([SETTINGS_KEY]);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return JSON.parse(row.value);
      }
      stmt.free();
    } catch {
      // No policy stored yet — return defaults
    }
    return { messages_days: null, audit_events_days: null, query_events_days: null };
  }

  updatePolicy(policy) {
    const value = JSON.stringify(policy);
    // Upsert into system_settings — parameterized
    const stmt = this.db.prepare("SELECT key FROM system_settings WHERE key = ?");
    stmt.bind([SETTINGS_KEY]);
    const exists = stmt.step();
    stmt.free();

    if (exists) {
      this.db.run("UPDATE system_settings SET value = ?, updated_at = ? WHERE key = ?",
        [value, new Date().toISOString(), SETTINGS_KEY]);
    } else {
      this.db.run("INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)",
        [SETTINGS_KEY, value, new Date().toISOString()]);
    }
    this.markDirty();
  }

  purge() {
    const policy = this.getPolicy();
    const result = { messages: 0, audit_events: 0, query_events: 0 };
    const now = new Date();

    if (policy.messages_days) {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - policy.messages_days);
      const iso = cutoff.toISOString();
      const countStmt = this.db.prepare("SELECT COUNT(*) as cnt FROM messages WHERE created_at < ?");
      countStmt.bind([iso]);
      if (countStmt.step()) {
        result.messages = countStmt.getAsObject().cnt;
      }
      countStmt.free();
      if (result.messages > 0) {
        this.db.run("DELETE FROM messages WHERE created_at < ?", [iso]);
      }
    }

    if (policy.audit_events_days) {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - policy.audit_events_days);
      const iso = cutoff.toISOString();
      const countStmt = this.db.prepare("SELECT COUNT(*) as cnt FROM audit_events WHERE timestamp < ?");
      countStmt.bind([iso]);
      if (countStmt.step()) {
        result.audit_events = countStmt.getAsObject().cnt;
      }
      countStmt.free();
      if (result.audit_events > 0) {
        this.db.run("DELETE FROM audit_events WHERE timestamp < ?", [iso]);
      }
    }

    if (policy.query_events_days) {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - policy.query_events_days);
      const iso = cutoff.toISOString();
      const countStmt = this.db.prepare("SELECT COUNT(*) as cnt FROM query_events WHERE timestamp < ?");
      countStmt.bind([iso]);
      if (countStmt.step()) {
        result.query_events = countStmt.getAsObject().cnt;
      }
      countStmt.free();
      if (result.query_events > 0) {
        this.db.run("DELETE FROM query_events WHERE timestamp < ?", [iso]);
      }
    }

    this.markDirty();
    return result;
  }
}

module.exports = { RetentionService };
