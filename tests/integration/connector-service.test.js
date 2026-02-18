/**
 * RED → GREEN — ConnectorService: CRUD + Approval Lifecycle
 */

const initSqlJs = require("sql.js");
const { initSchema } = require("../../src/db/schema");

let ConnectorService;
try {
  ConnectorService = require("../../src/integration/connector-service").ConnectorService;
} catch {
  // Will fail in RED phase
}

describe("ConnectorService", () => {
  let db, service, markDirty;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    // Store SQL constructor for reuse
    global._SQL = SQL;
  });

  beforeEach(() => {
    db = new global._SQL.Database();
    db.run("PRAGMA foreign_keys = ON");
    initSchema(db);
    markDirty = jest.fn();
    service = new ConnectorService(db, markDirty);
  });

  afterEach(() => {
    if (db) db.close();
  });

  it("creates a connector with status=pending by default", () => {
    const connector = service.createConnector({
      name: "Zapier Webhook",
      type: "webhook",
      config: { url: "https://hooks.zapier.com/test" },
      description: "Zapier integration",
    });

    expect(connector).toBeTruthy();
    expect(connector.name).toBe("Zapier Webhook");
    expect(connector.type).toBe("webhook");
    expect(connector.status).toBe("pending");
    expect(connector.config).toEqual({ url: "https://hooks.zapier.com/test" });
    expect(markDirty).toHaveBeenCalled();
  });

  it("getConnector returns parsed config and auth_config", () => {
    const created = service.createConnector({
      name: "Test",
      type: "api",
      config: { key: "val" },
      auth_type: "bearer",
      auth_config: { token: "abc" },
    });

    const fetched = service.getConnector(created.id);
    expect(fetched.config).toEqual({ key: "val" });
    expect(fetched.auth_config).toEqual({ token: "abc" });
  });

  it("listConnectors returns all connectors", () => {
    service.createConnector({ name: "A", type: "webhook" });
    service.createConnector({ name: "B", type: "api" });
    service.createConnector({ name: "C", type: "webhook" });

    const all = service.listConnectors();
    expect(all.length).toBe(3);
  });

  it("listConnectors supports status filter", () => {
    service.createConnector({ name: "A", type: "webhook" });
    const b = service.createConnector({ name: "B", type: "api" });
    service.approveConnector(b.id, "admin");

    const pending = service.listConnectors({ status: "pending" });
    expect(pending.length).toBe(1);
    expect(pending[0].name).toBe("A");

    const approved = service.listConnectors({ status: "approved" });
    expect(approved.length).toBe(1);
    expect(approved[0].name).toBe("B");
  });

  it("updateConnector modifies allowed columns", () => {
    const created = service.createConnector({ name: "Old", type: "webhook" });
    const updated = service.updateConnector(created.id, {
      name: "New Name",
      description: "Updated desc",
    });

    expect(updated.name).toBe("New Name");
    expect(updated.description).toBe("Updated desc");
  });

  it("updateConnector rejects disallowed columns", () => {
    const created = service.createConnector({ name: "Test", type: "webhook" });
    const updated = service.updateConnector(created.id, {
      id: "hacked",
      created_at: "hacked",
    });

    // id should not change
    expect(updated.id).toBe(created.id);
  });

  it("deleteConnector removes the connector", () => {
    const created = service.createConnector({ name: "Delete Me", type: "webhook" });
    service.deleteConnector(created.id);

    const fetched = service.getConnector(created.id);
    expect(fetched).toBeNull();
  });

  it("approveConnector sets status=approved and records approver", () => {
    const created = service.createConnector({ name: "Approve Me", type: "webhook" });
    const approved = service.approveConnector(created.id, "admin-user");

    expect(approved.status).toBe("approved");
    expect(approved.approved_by).toBe("admin-user");
    expect(approved.approved_at).toBeTruthy();
  });

  it("suspendConnector sets status=suspended", () => {
    const created = service.createConnector({ name: "Suspend Me", type: "webhook" });
    service.approveConnector(created.id, "admin");
    const suspended = service.suspendConnector(created.id);

    expect(suspended.status).toBe("suspended");
  });

  it("logEvent and getEvents work", () => {
    const created = service.createConnector({ name: "Evented", type: "webhook" });
    service.logEvent(created.id, "health_check", { status: "ok" });
    service.logEvent(created.id, "invocation", { latency: 120 });

    const events = service.getEvents(created.id);
    expect(events.length).toBe(2);
    const types = events.map((e) => e.event_type).sort();
    expect(types).toEqual(["health_check", "invocation"]);
    const invocationEvent = events.find((e) => e.event_type === "invocation");
    expect(invocationEvent.details).toEqual({ latency: 120 });
  });
});
