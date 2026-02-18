/**
 * TDD RED → GREEN: GDPR Right to Erasure
 */

const initSqlJs = require('sql.js');
const { initSchema } = require('../../src/db/schema');
const { GDPRService } = require('../../src/gdpr/gdpr-service');
const { v4: uuidv4 } = require('uuid');

describe('GDPRService - Right to Erasure', () => {
  let db, gdpr, markDirty, SQL, hash;

  beforeAll(async () => {
    SQL = await initSqlJs();
    const bcrypt = require('bcryptjs');
    hash = await bcrypt.hash('pw', 4);
  });

  beforeEach(() => {
    // Fresh DB for each test to avoid state leaks
    db = new SQL.Database();
    db.run("PRAGMA foreign_keys = ON");
    initSchema(db);
    markDirty = jest.fn();
    gdpr = new GDPRService(db, markDirty);

    // Seed test data
    db.run("INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)",
      ['u1', 'alice', hash, 'admin']);
    db.run("INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)",
      ['u2', 'bob', hash, 'viewer']);

    // Alice's data
    db.run("INSERT INTO sessions (id, title, profile, user_id) VALUES ('s1', 'Alice Chat', 'main', 'u1')");
    db.run("INSERT INTO messages (id, session_id, role, content) VALUES (1, 's1', 'user', 'Hello')");
    db.run("INSERT INTO messages (id, session_id, role, content) VALUES (2, 's1', 'assistant', 'Hi')");
    db.run("INSERT INTO user_consents (id, user_id, consent_type, granted, granted_at) VALUES (?, 'u1', 'data_processing', 1, ?)",
      [uuidv4(), new Date().toISOString()]);
    db.run("INSERT INTO audit_events (id, event_type, severity, action, user_id, timestamp) VALUES (?, 'query', 'info', 'chat', 'u1', ?)",
      [uuidv4(), new Date().toISOString()]);

    // Bob's data (should not be affected)
    db.run("INSERT INTO sessions (id, title, profile, user_id) VALUES ('s2', 'Bob Chat', 'main', 'u2')");
    db.run("INSERT INTO messages (id, session_id, role, content) VALUES (3, 's2', 'user', 'Bob here')");
  });

  afterEach(() => { if (db) db.close(); });

  it('deletes the user from users table', () => {
    gdpr.eraseUserData('u1');
    const result = db.exec("SELECT COUNT(*) FROM users WHERE id = 'u1'");
    expect(result[0].values[0][0]).toBe(0);
  });

  it('deletes all user sessions', () => {
    gdpr.eraseUserData('u1');
    const result = db.exec("SELECT COUNT(*) FROM sessions WHERE user_id = 'u1'");
    expect(result[0].values[0][0]).toBe(0);
  });

  it('deletes all messages in user sessions', () => {
    gdpr.eraseUserData('u1');
    const result = db.exec("SELECT COUNT(*) FROM messages WHERE session_id = 's1'");
    expect(result[0].values[0][0]).toBe(0);
  });

  it('deletes all user consents', () => {
    gdpr.eraseUserData('u1');
    const result = db.exec("SELECT COUNT(*) FROM user_consents WHERE user_id = 'u1'");
    expect(result[0].values[0][0]).toBe(0);
  });

  it('anonymizes audit events (sets user_id to DELETED)', () => {
    gdpr.eraseUserData('u1');
    const result = db.exec("SELECT user_id FROM audit_events");
    result[0].values.forEach(row => {
      expect(row[0]).toBe('DELETED');
    });
  });

  it('does not affect other users data', () => {
    gdpr.eraseUserData('u1');
    // Bob's data should be intact
    const bobUser = db.exec("SELECT COUNT(*) FROM users WHERE id = 'u2'");
    expect(bobUser[0].values[0][0]).toBe(1);
    const bobSessions = db.exec("SELECT COUNT(*) FROM sessions WHERE user_id = 'u2'");
    expect(bobSessions[0].values[0][0]).toBe(1);
    const bobMessages = db.exec("SELECT COUNT(*) FROM messages WHERE session_id = 's2'");
    expect(bobMessages[0].values[0][0]).toBe(1);
  });

  it('after erasure, exportUserData returns empty structure', () => {
    gdpr.eraseUserData('u1');
    const data = gdpr.exportUserData('u1');
    expect(data.user).toBeNull();
    expect(data.sessions).toEqual([]);
    expect(data.consents).toEqual([]);
  });

  it('calls markDirty after erasure', () => {
    markDirty.mockClear();
    gdpr.eraseUserData('u1');
    expect(markDirty).toHaveBeenCalled();
  });

  it('erasure of nonexistent user does not throw', () => {
    expect(() => gdpr.eraseUserData('nonexistent')).not.toThrow();
  });
});
