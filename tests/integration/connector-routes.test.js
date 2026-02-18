/**
 * RED → GREEN — Integration Routes
 * Tests Express routes for connector CRUD and approval workflow.
 */

const express = require("express");
const request = require("supertest");
const initSqlJs = require("sql.js");
const { initSchema } = require("../../src/db/schema");
const { ConnectorService } = require("../../src/integration/connector-service");
const { createIntegrationRoutes } = require("../../src/integration/routes");

describe("Integration Routes", () => {
  let app, db, service;

  beforeAll(async () => {
    global._SQL = await initSqlJs();
  });

  beforeEach(() => {
    db = new global._SQL.Database();
    db.run("PRAGMA foreign_keys = ON");
    initSchema(db);
    service = new ConnectorService(db, jest.fn());

    app = express();
    app.use(express.json());
    // Mock user for approve
    app.use((req, _res, next) => {
      req.user = { username: "admin", role: "admin" };
      next();
    });
    app.use("/api/integrations", createIntegrationRoutes(service));
  });

  afterEach(() => {
    if (db) db.close();
  });

  it("POST /api/integrations creates a connector", async () => {
    const res = await request(app)
      .post("/api/integrations")
      .send({ name: "Test Webhook", type: "webhook" });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Test Webhook");
    expect(res.body.status).toBe("pending");
  });

  it("GET /api/integrations lists all connectors", async () => {
    service.createConnector({ name: "A", type: "webhook" });
    service.createConnector({ name: "B", type: "api" });

    const res = await request(app).get("/api/integrations");
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it("GET /api/integrations?status=pending filters by status", async () => {
    const c = service.createConnector({ name: "A", type: "webhook" });
    service.createConnector({ name: "B", type: "api" });
    service.approveConnector(c.id, "admin");

    const res = await request(app).get("/api/integrations?status=pending");
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].name).toBe("B");
  });

  it("GET /api/integrations/:id returns a single connector", async () => {
    const c = service.createConnector({ name: "Single", type: "webhook" });

    const res = await request(app).get(`/api/integrations/${c.id}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Single");
  });

  it("GET /api/integrations/:id returns 404 for missing connector", async () => {
    const res = await request(app).get("/api/integrations/nonexistent");
    expect(res.status).toBe(404);
  });

  it("PUT /api/integrations/:id updates a connector", async () => {
    const c = service.createConnector({ name: "Old", type: "webhook" });

    const res = await request(app)
      .put(`/api/integrations/${c.id}`)
      .send({ name: "Updated" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Updated");
  });

  it("DELETE /api/integrations/:id removes a connector", async () => {
    const c = service.createConnector({ name: "Delete Me", type: "webhook" });

    const res = await request(app).delete(`/api/integrations/${c.id}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const check = await request(app).get(`/api/integrations/${c.id}`);
    expect(check.status).toBe(404);
  });

  it("POST /api/integrations/:id/approve sets status to approved", async () => {
    const c = service.createConnector({ name: "Approve Me", type: "webhook" });

    const res = await request(app).post(`/api/integrations/${c.id}/approve`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("approved");
    expect(res.body.approved_by).toBe("admin");
  });

  it("POST /api/integrations/:id/suspend sets status to suspended", async () => {
    const c = service.createConnector({ name: "Suspend Me", type: "webhook" });
    service.approveConnector(c.id, "admin");

    const res = await request(app).post(`/api/integrations/${c.id}/suspend`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("suspended");
  });

  it("GET /api/integrations/:id/events returns event history", async () => {
    const c = service.createConnector({ name: "Evented", type: "webhook" });
    service.logEvent(c.id, "test_event", { data: "hello" });

    const res = await request(app).get(`/api/integrations/${c.id}/events`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });
});
