/**
 * TDD RED → GREEN: GDPR Data Export (Right to Access)
 */

const initSqlJs = require('sql.js');
const { initSchema } = require('../../src/db/schema');
const { GDPRService } = require('../../src/gdpr/gdpr-service');
const { v4: uuidv4 } = require('uuid');

describe('GDPRService - Data Export', () => {
  let db, gdpr, markDirty;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    db = new SQL.Database();
    db.run("PRAGMA foreign_keys = ON");
    initSchema(db);
    markDirty = jest.fn();
    gdpr = new GDPRService(db, markDirty);

    // Create test users
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('password', 4);
    db.run("INSERT INTO users (id, username, email, password_hash, role, display_name, department) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ['u1', 'alice', 'alice@test.com', hash, 'admin', 'Alice Smith', 'Engineering']);
    db.run("INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)",
      ['u2', 'bob', hash, 'viewer']);

    // Create sessions and messages for u1
    db.run("INSERT INTO sessions (id, title, profile, user_id) VALUES (?, ?, ?, ?)",
      ['s1', 'Chat 1', 'main', 'u1']);
    db.run("INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)",
      [1, 's1', 'user', 'Hello from Alice']);
    db.run("INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)",
      [2, 's1', 'assistant', 'Hi Alice!']);

    // Create session for u2
    db.run("INSERT INTO sessions (id, title, profile, user_id) VALUES (?, ?, ?, ?)",
      ['s2', 'Bob Chat', 'main', 'u2']);
    db.run("INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)",
      [3, 's2', 'user', 'Hello from Bob']);

    // Create consents for u1
    db.run("INSERT INTO user_consents (id, user_id, consent_type, granted, granted_at) VALUES (?, ?, ?, 1, ?)",
      [uuidv4(), 'u1', 'data_processing', new Date().toISOString()]);

    // Create audit events referencing u1
    db.run("INSERT INTO audit_events (id, event_type, severity, action, user_id, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
      [uuidv4(), 'query', 'info', 'chat', 'u1', new Date().toISOString()]);
  });

  afterAll(() => { if (db) db.close(); });

  it('exports all data for a user', () => {
    const data = gdpr.exportUserData('u1');
    expect(data.user).toBeDefined();
    expect(data.user.username).toBe('alice');
    expect(data.user.email).toBe('alice@test.com');
    expect(data.user.display_name).toBe('Alice Smith');
    // Should NOT include password hash
    expect(data.user.password_hash).toBeUndefined();
  });

  it('includes user sessions and messages', () => {
    const data = gdpr.exportUserData('u1');
    expect(data.sessions.length).toBe(1);
    expect(data.sessions[0].id).toBe('s1');
    expect(data.sessions[0].messages.length).toBe(2);
  });

  it('excludes other users data', () => {
    const data = gdpr.exportUserData('u1');
    const sessionIds = data.sessions.map(s => s.id);
    expect(sessionIds).not.toContain('s2');
  });

  it('includes consents', () => {
    const data = gdpr.exportUserData('u1');
    expect(data.consents.length).toBe(1);
    expect(data.consents[0].consent_type).toBe('data_processing');
  });

  it('includes audit event references', () => {
    const data = gdpr.exportUserData('u1');
    expect(data.audit_events.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty structure for nonexistent user', () => {
    const data = gdpr.exportUserData('nonexistent');
    expect(data.user).toBeNull();
    expect(data.sessions).toEqual([]);
    expect(data.consents).toEqual([]);
    expect(data.audit_events).toEqual([]);
  });

  it('includes export metadata', () => {
    const data = gdpr.exportUserData('u1');
    expect(data.exported_at).toBeDefined();
    expect(data.format_version).toBe('1.0');
  });
});
