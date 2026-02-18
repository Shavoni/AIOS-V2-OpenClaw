describe("Database Schema", () => {
  let db;

  beforeAll(async () => {
    const initSqlJs = require("sql.js");
    const SQL = await initSqlJs();
    db = new SQL.Database();
    db.run("PRAGMA foreign_keys = ON");

    const { initSchema } = require("../../src/db/schema");
    initSchema(db);
  });

  afterAll(() => {
    if (db) db.close();
  });

  test("creates sessions table", () => {
    const result = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'");
    expect(result.length).toBe(1);
  });

  test("creates messages table", () => {
    const result = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='messages'");
    expect(result.length).toBe(1);
  });

  test("creates audit_log table", () => {
    const result = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='audit_log'");
    expect(result.length).toBe(1);
  });

  test("creates skill_invocations table", () => {
    const result = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='skill_invocations'");
    expect(result.length).toBe(1);
  });

  test("sessions table has correct columns", () => {
    const result = db.exec("PRAGMA table_info(sessions)");
    const columns = result[0].values.map(row => row[1]);
    expect(columns).toContain("id");
    expect(columns).toContain("title");
    expect(columns).toContain("profile");
    expect(columns).toContain("created_at");
    expect(columns).toContain("updated_at");
  });

  test("messages table has correct columns", () => {
    const result = db.exec("PRAGMA table_info(messages)");
    const columns = result[0].values.map(row => row[1]);
    expect(columns).toContain("session_id");
    expect(columns).toContain("role");
    expect(columns).toContain("content");
    expect(columns).toContain("metadata");
  });

  test("can insert and query a session", () => {
    db.run("INSERT INTO sessions (id, title, profile) VALUES ('s1', 'Test', 'main')");
    const result = db.exec("SELECT * FROM sessions WHERE id='s1'");
    expect(result[0].values.length).toBe(1);
    expect(result[0].values[0][1]).toBe("Test");
  });

  test("can insert and query a message", () => {
    db.run("INSERT INTO messages (session_id, role, content) VALUES ('s1', 'user', 'Hello')");
    const result = db.exec("SELECT * FROM messages WHERE session_id='s1'");
    expect(result[0].values.length).toBe(1);
  });

  test("cascade deletes messages when session deleted", () => {
    db.run("DELETE FROM sessions WHERE id='s1'");
    const result = db.exec("SELECT * FROM messages WHERE session_id='s1'");
    expect(result.length).toBe(0);
  });
});
