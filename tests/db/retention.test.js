const initSqlJs = require('sql.js');
const { RetentionService } = require('../../src/db/retention-service');
const { initSchema } = require('../../src/db/schema');
const { v4: uuidv4 } = require('uuid');

describe('RetentionService', () => {
  let db, retention, markDirty;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    db = new SQL.Database();
    db.run("PRAGMA foreign_keys = ON");
    initSchema(db);
    markDirty = jest.fn();
    retention = new RetentionService(db, markDirty);
  });

  afterAll(() => { if (db) db.close(); });

  // Helper to insert test data with specific dates
  // NOTE: messages.id is INTEGER PRIMARY KEY AUTOINCREMENT, so we omit it
  function insertMessage(sessionId, daysAgo) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const iso = date.toISOString();
    db.run("INSERT INTO messages (session_id, role, content, created_at) VALUES (?, 'user', 'test', ?)",
      [sessionId, iso]);
  }

  function insertAuditEvent(daysAgo) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const iso = date.toISOString();
    db.run("INSERT INTO audit_events (id, event_type, severity, action, timestamp) VALUES (?, 'test', 'info', 'test', ?)",
      [uuidv4(), iso]);
  }

  function insertQueryEvent(daysAgo) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const iso = date.toISOString();
    db.run("INSERT INTO query_events (id, timestamp) VALUES (?, ?)",
      [uuidv4(), iso]);
  }

  it('returns default policy when none configured', () => {
    const policy = retention.getPolicy();
    expect(policy).toEqual({
      messages_days: null,
      audit_events_days: null,
      query_events_days: null,
    });
  });

  it('saves and retrieves a retention policy', () => {
    retention.updatePolicy({ messages_days: 90, audit_events_days: 365, query_events_days: 180 });
    const policy = retention.getPolicy();
    expect(policy.messages_days).toBe(90);
    expect(policy.audit_events_days).toBe(365);
    expect(policy.query_events_days).toBe(180);
  });

  it('purge is a no-op when all retention days are null', () => {
    retention.updatePolicy({ messages_days: null, audit_events_days: null, query_events_days: null });
    const result = retention.purge();
    expect(result.messages).toBe(0);
    expect(result.audit_events).toBe(0);
    expect(result.query_events).toBe(0);
  });

  it('purges messages older than configured days', () => {
    // Create a session
    db.run("INSERT INTO sessions (id, title, profile) VALUES ('ret-s1', 'Retention Test', 'main')");

    // Insert messages: 2 old (100 days ago), 1 recent (5 days ago)
    insertMessage('ret-s1', 100);
    insertMessage('ret-s1', 100);
    insertMessage('ret-s1', 5);

    retention.updatePolicy({ messages_days: 30, audit_events_days: null, query_events_days: null });
    const result = retention.purge();
    expect(result.messages).toBe(2); // 2 old messages purged

    // Verify recent message still exists
    const remaining = db.exec("SELECT COUNT(*) FROM messages WHERE session_id = 'ret-s1'");
    expect(remaining[0].values[0][0]).toBe(1);
  });

  it('purges audit events older than configured days', () => {
    insertAuditEvent(400);
    insertAuditEvent(400);
    insertAuditEvent(10);

    retention.updatePolicy({ messages_days: null, audit_events_days: 365, query_events_days: null });
    const result = retention.purge();
    expect(result.audit_events).toBe(2);
  });

  it('purges query events older than configured days', () => {
    insertQueryEvent(200);
    insertQueryEvent(200);
    insertQueryEvent(10);

    retention.updatePolicy({ messages_days: null, audit_events_days: null, query_events_days: 180 });
    const result = retention.purge();
    expect(result.query_events).toBe(2);
  });

  it('calls markDirty after purge', () => {
    markDirty.mockClear();
    retention.updatePolicy({ messages_days: 9999, audit_events_days: null, query_events_days: null });
    retention.purge();
    expect(markDirty).toHaveBeenCalled();
  });
});
