const { v4: uuidv4 } = require('uuid');

class ConsentService {
  constructor(db, markDirty) {
    this.db = db;
    this.markDirty = markDirty || (() => {});
  }

  grantConsent(userId, consentType) {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db.run(
      "INSERT INTO user_consents (id, user_id, consent_type, granted, granted_at) VALUES (?, ?, ?, 1, ?)",
      [id, userId, consentType, now]
    );
    this.markDirty();
    return { id, user_id: userId, consent_type: consentType, granted: 1, granted_at: now, revoked_at: null };
  }

  revokeConsent(userId, consentType) {
    const now = new Date().toISOString();
    this.db.run(
      "UPDATE user_consents SET granted = 0, revoked_at = ? WHERE user_id = ? AND consent_type = ? AND granted = 1",
      [now, userId, consentType]
    );
    this.markDirty();
  }

  hasConsent(userId, consentType) {
    const stmt = this.db.prepare(
      "SELECT id FROM user_consents WHERE user_id = ? AND consent_type = ? AND granted = 1 LIMIT 1"
    );
    stmt.bind([userId, consentType]);
    const found = stmt.step();
    stmt.free();
    return found;
  }

  getConsents(userId) {
    const stmt = this.db.prepare(
      "SELECT id, user_id, consent_type, granted, granted_at, revoked_at FROM user_consents WHERE user_id = ? ORDER BY granted_at DESC"
    );
    stmt.bind([userId]);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }
}

module.exports = { ConsentService };
