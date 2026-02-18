/**
 * TDD RED → GREEN: GDPR Consent Tracking
 */

const initSqlJs = require('sql.js');
const { initSchema } = require('../../src/db/schema');
const { ConsentService } = require('../../src/gdpr/consent-service');

describe('ConsentService', () => {
  let db, consent, markDirty;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    db = new SQL.Database();
    db.run("PRAGMA foreign_keys = ON");
    initSchema(db);
    markDirty = jest.fn();
    consent = new ConsentService(db, markDirty);

    // Create a test user
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('password', 4);
    db.run(
      "INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)",
      ['u1', 'testuser', hash, 'viewer']
    );
  });

  afterAll(() => { if (db) db.close(); });

  it('grants a consent record', () => {
    const record = consent.grantConsent('u1', 'data_processing');
    expect(record.id).toBeDefined();
    expect(record.user_id).toBe('u1');
    expect(record.consent_type).toBe('data_processing');
    expect(record.granted).toBe(1);
    expect(record.granted_at).toBeDefined();
    expect(record.revoked_at).toBeNull();
  });

  it('grants multiple consent types', () => {
    consent.grantConsent('u1', 'analytics');
    consent.grantConsent('u1', 'marketing');
    const all = consent.getConsents('u1');
    expect(all.length).toBe(3); // data_processing + analytics + marketing
  });

  it('hasConsent returns true for granted consent', () => {
    expect(consent.hasConsent('u1', 'data_processing')).toBe(true);
  });

  it('hasConsent returns false for non-existent consent', () => {
    expect(consent.hasConsent('u1', 'nonexistent')).toBe(false);
  });

  it('revokes a consent', () => {
    consent.revokeConsent('u1', 'marketing');
    expect(consent.hasConsent('u1', 'marketing')).toBe(false);

    const all = consent.getConsents('u1');
    const marketing = all.find(c => c.consent_type === 'marketing');
    expect(marketing.revoked_at).toBeDefined();
    expect(marketing.granted).toBe(0);
  });

  it('getConsents returns all records including revoked', () => {
    const all = consent.getConsents('u1');
    expect(all.length).toBe(3);
    const revoked = all.filter(c => c.granted === 0);
    expect(revoked.length).toBe(1);
  });

  it('getConsents returns empty array for unknown user', () => {
    expect(consent.getConsents('nonexistent')).toEqual([]);
  });

  it('re-granting a revoked consent creates a new active record', () => {
    consent.grantConsent('u1', 'marketing');
    expect(consent.hasConsent('u1', 'marketing')).toBe(true);
  });

  it('calls markDirty on grant and revoke', () => {
    markDirty.mockClear();
    consent.grantConsent('u1', 'temp_consent');
    expect(markDirty).toHaveBeenCalled();
    markDirty.mockClear();
    consent.revokeConsent('u1', 'temp_consent');
    expect(markDirty).toHaveBeenCalled();
  });
});
