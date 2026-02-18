const SETTINGS_KEY = 'retention_policy';

const PURGE_TARGETS = [
  { table: 'messages',     column: 'created_at', policyKey: 'messages_days',      resultKey: 'messages' },
  { table: 'audit_events', column: 'timestamp',  policyKey: 'audit_events_days',  resultKey: 'audit_events' },
  { table: 'query_events', column: 'timestamp',  policyKey: 'query_events_days',  resultKey: 'query_events' },
];

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
      // No policy stored yet
    }
    return { messages_days: null, audit_events_days: null, query_events_days: null };
  }

  updatePolicy(policy) {
    const value = JSON.stringify(policy);
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
    const result = {};
    const now = Date.now();

    for (const { table, column, policyKey, resultKey } of PURGE_TARGETS) {
      result[resultKey] = 0;
      const days = policy[policyKey];
      if (!days) continue;

      const cutoff = new Date(now - days * 86400000).toISOString();
      const countStmt = this.db.prepare(`SELECT COUNT(*) as cnt FROM ${table} WHERE ${column} < ?`);
      countStmt.bind([cutoff]);
      if (countStmt.step()) result[resultKey] = countStmt.getAsObject().cnt;
      countStmt.free();

      if (result[resultKey] > 0) {
        this.db.run(`DELETE FROM ${table} WHERE ${column} < ?`, [cutoff]);
      }
    }

    this.markDirty();
    return result;
  }
}

module.exports = { RetentionService };
