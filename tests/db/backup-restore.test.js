const initSqlJs = require('sql.js');
const { BackupService } = require('../../src/db/backup-service');
const { initSchema } = require('../../src/db/schema');

describe('BackupService', () => {
  let db, backupService;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    db = new SQL.Database();
    db.run("PRAGMA foreign_keys = ON");
    initSchema(db);
    backupService = new BackupService(db);
  });

  afterAll(() => { if (db) db.close(); });

  it('creates a backup as Buffer', () => {
    const backup = backupService.createBackup();
    expect(Buffer.isBuffer(backup)).toBe(true);
    expect(backup.length).toBeGreaterThan(0);
  });

  it('backup contains valid SQLite data', async () => {
    // Insert test data
    db.run("INSERT INTO sessions (id, title, profile) VALUES ('s1', 'Test', 'main')");

    const backup = backupService.createBackup();

    // Load backup into fresh instance
    const SQL = await initSqlJs();
    const restored = new SQL.Database(new Uint8Array(backup));
    const result = restored.exec("SELECT title FROM sessions WHERE id = 's1'");
    expect(result.length).toBe(1);
    expect(result[0].values[0][0]).toBe('Test');
    restored.close();
  });

  it('validates backup before restore', () => {
    expect(() => backupService.validateBackup(Buffer.from('not-sqlite')))
      .toThrow(/invalid/i);
  });

  it('validates backup with correct SQLite magic bytes', () => {
    const backup = backupService.createBackup();
    expect(() => backupService.validateBackup(backup)).not.toThrow();
  });

  it('getBackupMetadata returns size and timestamp', () => {
    const backup = backupService.createBackup();
    const meta = backupService.getBackupMetadata(backup);
    expect(meta.sizeBytes).toBeGreaterThan(0);
    expect(meta.timestamp).toBeDefined();
    expect(typeof meta.sizeFormatted).toBe('string');
  });

  it('rejects empty buffer', () => {
    expect(() => backupService.validateBackup(Buffer.alloc(0)))
      .toThrow(/empty/i);
  });
});
