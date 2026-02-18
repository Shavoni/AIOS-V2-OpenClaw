/**
 * RED → GREEN — Agent-Connector Wiring
 * Tests that connectors can be linked to agents and queried.
 */

const initSqlJs = require("sql.js");
const { initSchema } = require("../../src/db/schema");
const { ConnectorService } = require("../../src/integration/connector-service");

describe("Agent-Connector Wiring", () => {
  let db, service;

  beforeAll(async () => {
    global._SQL = await initSqlJs();
  });

  beforeEach(() => {
    db = new global._SQL.Database();
    db.run("PRAGMA foreign_keys = ON");
    initSchema(db);
    service = new ConnectorService(db, jest.fn());

    // Create a test agent
    db.run(
      "INSERT INTO agents (id, name, domain, status) VALUES (?, ?, ?, ?)",
      ["agent-1", "Test Agent", "devops", "active"]
    );
  });

  afterEach(() => {
    if (db) db.close();
  });

  it("connector can be assigned to an agent via agent_id", () => {
    const connector = service.createConnector({
      name: "Agent Webhook",
      type: "webhook",
      agent_id: "agent-1",
    });

    expect(connector.agent_id).toBe("agent-1");
  });

  it("getByAgent returns connectors linked to a specific agent", () => {
    service.createConnector({ name: "A", type: "webhook", agent_id: "agent-1" });
    service.createConnector({ name: "B", type: "api", agent_id: "agent-1" });
    service.createConnector({ name: "C", type: "webhook" }); // no agent

    const agentConnectors = service.getByAgent("agent-1");
    expect(agentConnectors.length).toBe(2);
    const names = agentConnectors.map((c) => c.name).sort();
    expect(names).toEqual(["A", "B"]);
  });

  it("removing agent sets connector agent_id to NULL (ON DELETE SET NULL)", () => {
    service.createConnector({ name: "Linked", type: "webhook", agent_id: "agent-1" });

    // Delete the agent
    db.run("DELETE FROM agents WHERE id = ?", ["agent-1"]);

    const connectors = service.listConnectors();
    expect(connectors.length).toBe(1);
    // agent_id should be null after agent deletion
    expect(connectors[0].agent_id).toBeNull();
  });

  it("updateConnector can reassign agent_id", () => {
    const connector = service.createConnector({
      name: "Reassign Me",
      type: "api",
      agent_id: "agent-1",
    });

    // Create a second agent
    db.run(
      "INSERT INTO agents (id, name, domain, status) VALUES (?, ?, ?, ?)",
      ["agent-2", "Other Agent", "ai", "active"]
    );

    const updated = service.updateConnector(connector.id, { agent_id: "agent-2" });
    expect(updated.agent_id).toBe("agent-2");

    // Verify getByAgent reflects the change
    const agent1Connectors = service.getByAgent("agent-1");
    expect(agent1Connectors.length).toBe(0);

    const agent2Connectors = service.getByAgent("agent-2");
    expect(agent2Connectors.length).toBe(1);
    expect(agent2Connectors[0].name).toBe("Reassign Me");
  });
});
