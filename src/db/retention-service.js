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
    // Upsert into system_settings
    const existing = this.db.exec(`SELECT key FROM system_settings WHERE key = '${SETTINGS_KEY}'`);
    if (existing.length > 0 && existing[0].values.length > 0) {
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
      // Count rows to be deleted
      const countResult = this.db.exec(`SELECT COUNT(*) FROM messages WHERE created_at < '${iso}'`);
      result.messages = countResult.length > 0 ? countResult[0].values[0][0] : 0;
      if (result.messages > 0) {
        this.db.run("DELETE FROM messages WHERE created_at < ?", [iso]);
      }
    }

    if (policy.audit_events_days) {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - policy.audit_events_days);
      const iso = cutoff.toISOString();
      const countResult = this.db.exec(`SELECT COUNT(*) FROM audit_events WHERE timestamp < '${iso}'`);
      result.audit_events = countResult.length > 0 ? countResult[0].values[0][0] : 0;
      if (result.audit_events > 0) {
        this.db.run("DELETE FROM audit_events WHERE timestamp < ?", [iso]);
      }
    }

    if (policy.query_events_days) {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - policy.query_events_days);
      const iso = cutoff.toISOString();
      const countResult = this.db.exec(`SELECT COUNT(*) FROM query_events WHERE timestamp < '${iso}'`);
      result.query_events = countResult.length > 0 ? countResult[0].values[0][0] : 0;
      if (result.query_events > 0) {
        this.db.run("DELETE FROM query_events WHERE timestamp < ?", [iso]);
      }
    }

    this.markDirty();
    return result;
  }
}

module.exports = { RetentionService };
