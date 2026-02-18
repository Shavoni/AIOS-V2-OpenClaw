/**
 * GDPR Service - Data Export (Right to Access) and Erasure (Right to be Forgotten)
 */

class GDPRService {
  constructor(db, markDirty) {
    this.db = db;
    this.markDirty = markDirty || (() => {});
  }

  /**
   * Export all data associated with a user (GDPR Right to Access).
   * Excludes sensitive fields like password_hash.
   */
  exportUserData(userId) {
    const result = {
      format_version: '1.0',
      exported_at: new Date().toISOString(),
      user: null,
      sessions: [],
      consents: [],
      audit_events: [],
    };

    // User profile (exclude password_hash)
    const userStmt = this.db.prepare(
      "SELECT id, username, email, role, display_name, department, is_active, last_login, created_at, updated_at FROM users WHERE id = ?"
    );
    userStmt.bind([userId]);
    if (userStmt.step()) {
      result.user = userStmt.getAsObject();
    }
    userStmt.free();

    if (!result.user) return result;

    // Sessions and their messages
    const sessStmt = this.db.prepare(
      "SELECT id, title, profile, created_at, updated_at FROM sessions WHERE user_id = ?"
    );
    sessStmt.bind([userId]);
    while (sessStmt.step()) {
      const session = sessStmt.getAsObject();
      // Get messages for this session
      const msgStmt = this.db.prepare(
        "SELECT id, role, content, metadata, created_at FROM messages WHERE session_id = ? ORDER BY created_at"
      );
      msgStmt.bind([session.id]);
      session.messages = [];
      while (msgStmt.step()) {
        session.messages.push(msgStmt.getAsObject());
      }
      msgStmt.free();
      result.sessions.push(session);
    }
    sessStmt.free();

    // Consents
    const consentStmt = this.db.prepare(
      "SELECT id, consent_type, granted, granted_at, revoked_at FROM user_consents WHERE user_id = ?"
    );
    consentStmt.bind([userId]);
    while (consentStmt.step()) {
      result.consents.push(consentStmt.getAsObject());
    }
    consentStmt.free();

    // Audit events referencing this user
    const auditStmt = this.db.prepare(
      "SELECT id, event_type, severity, action, timestamp FROM audit_events WHERE user_id = ? ORDER BY timestamp DESC LIMIT 1000"
    );
    auditStmt.bind([userId]);
    while (auditStmt.step()) {
      result.audit_events.push(auditStmt.getAsObject());
    }
    auditStmt.free();

    return result;
  }

  /**
   * Erase all data associated with a user (GDPR Right to Erasure).
   * Anonymizes audit events rather than deleting them (regulatory requirement).
   */
  eraseUserData(userId) {
    // 1. Delete messages in user's sessions (CASCADE would handle this, but be explicit)
    const sessStmt = this.db.prepare("SELECT id FROM sessions WHERE user_id = ?");
    sessStmt.bind([userId]);
    const sessionIds = [];
    while (sessStmt.step()) {
      sessionIds.push(sessStmt.getAsObject().id);
    }
    sessStmt.free();

    for (const sessionId of sessionIds) {
      this.db.run("DELETE FROM messages WHERE session_id = ?", [sessionId]);
    }

    // 2. Delete sessions
    this.db.run("DELETE FROM sessions WHERE user_id = ?", [userId]);

    // 3. Delete consents
    this.db.run("DELETE FROM user_consents WHERE user_id = ?", [userId]);

    // 4. Anonymize audit events (keep for compliance, but remove PII)
    this.db.run("UPDATE audit_events SET user_id = 'DELETED' WHERE user_id = ?", [userId]);

    // 5. Anonymize query events
    this.db.run("UPDATE query_events SET user_id = 'DELETED', query_text = NULL, response_text = NULL WHERE user_id = ?", [userId]);

    // 6. Delete refresh tokens
    this.db.run("DELETE FROM refresh_tokens WHERE user_id = ?", [userId]);

    // 7. Delete the user
    this.db.run("DELETE FROM users WHERE id = ?", [userId]);

    this.markDirty();
  }
}

module.exports = { GDPRService };
