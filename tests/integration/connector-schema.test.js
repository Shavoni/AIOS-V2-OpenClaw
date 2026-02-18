describe("Integration Connector Schema", () => {
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

  test("connectors table exists and accepts inserts", () => {
    db.run(
      `INSERT INTO connectors (id, name, type, status)
       VALUES ('c1', 'Test Connector', 'webhook', 'pending')`
    );
    const result = db.exec("SELECT * FROM connectors WHERE id='c1'");
    expect(result[0].values.length).toBe(1);
    expect(result[0].values[0][1]).toBe("Test Connector");
  });

  test("connector_events table exists and accepts inserts", () => {
    db.run(
      `INSERT INTO connector_events (connector_id, event_type, details)
       VALUES ('c1', 'created', '{"source":"test"}')`
    );
    const result = db.exec(
      "SELECT * FROM connector_events WHERE connector_id='c1'"
    );
    expect(result[0].values.length).toBe(1);
    expect(result[0].values[0][2]).toBe("created");
  });

  test("creating a connector with all required columns succeeds", () => {
    db.run(
      `INSERT INTO connectors
       (id, name, type, config, status, agent_id, description,
        auth_type, auth_config, health_status, last_health_check,
        created_by, approved_by, approved_at)
       VALUES
       ('c2', 'Full Connector', 'api', '{"url":"http://x"}', 'active', NULL,
        'A full connector', 'bearer', '{"token":"abc"}', 'healthy',
        datetime('now'), 'admin', 'reviewer', datetime('now'))`
    );
    const result = db.exec("SELECT * FROM connectors WHERE id='c2'");
    expect(result[0].values.length).toBe(1);
    expect(result[0].values[0][1]).toBe("Full Connector");
  });

  test("foreign key to agents works (agent_id references agents.id)", () => {
    // Insert a valid agent first
    db.run(
      `INSERT INTO agents (id, name, status) VALUES ('a1', 'Agent One', 'active')`
    );
    // Link connector to that agent
    db.run(
      `INSERT INTO connectors (id, name, type, status, agent_id)
       VALUES ('c3', 'Linked Connector', 'webhook', 'active', 'a1')`
    );
    const result = db.exec("SELECT agent_id FROM connectors WHERE id='c3'");
    expect(result[0].values[0][0]).toBe("a1");

    // Attempting to reference a non-existent agent should fail
    expect(() => {
      db.run(
        `INSERT INTO connectors (id, name, type, status, agent_id)
         VALUES ('c4', 'Bad Connector', 'webhook', 'active', 'nonexistent')`
      );
    }).toThrow();
  });
});
