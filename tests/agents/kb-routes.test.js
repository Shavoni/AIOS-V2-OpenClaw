/**
 * KB Architecture — Route-level tests
 * Tests all new API endpoints for the per-agent knowledge base.
 */

const { createTestDb } = require("../fixtures/test-db");
const { AgentManagerService } = require("../../src/agents/manager");
const { createAgentRoutes } = require("../../src/agents/routes");
const express = require("express");

// Tiny supertest-like helper (no external deps)
function createTestApp(agentManager) {
  const app = express();
  app.use(express.json());
  app.use("/api/agents", createAgentRoutes(agentManager));
  return app;
}

async function request(app, method, path, body) {
  return new Promise((resolve, reject) => {
    const http = require("http");
    const server = app.listen(0, () => {
      const port = server.address().port;
      const options = {
        hostname: "127.0.0.1",
        port,
        path,
        method: method.toUpperCase(),
        headers: { "Content-Type": "application/json" },
      };

      const req = http.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          server.close();
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      });

      req.on("error", (err) => { server.close(); reject(err); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  });
}

describe("KB Routes", () => {
  let db, manager, app, agentId;

  beforeAll(async () => {
    db = await createTestDb();
    manager = new AgentManagerService(db, jest.fn());
    app = createTestApp(manager);

    const agent = manager.createAgent({ name: "Route Test Agent", status: "active" });
    agentId = agent.id;
  });

  afterAll(() => { if (db) db.close(); });

  test("POST /:id/knowledge creates a document", async () => {
    const res = await request(app, "POST", `/api/agents/${agentId}/knowledge`, {
      filename: "test.txt",
      file_type: "txt",
      file_size: 100,
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
  });

  test("GET /:id/knowledge lists documents", async () => {
    const res = await request(app, "GET", `/api/agents/${agentId}/knowledge`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  test("GET /:id/knowledge/:docId returns single document", async () => {
    const doc = manager.addKnowledgeDocument(agentId, { filename: "single.txt", file_type: "txt" });
    const res = await request(app, "GET", `/api/agents/${agentId}/knowledge/${doc.id}`);
    expect(res.status).toBe(200);
    expect(res.body.filename).toBe("single.txt");
  });

  test("PUT /:id/knowledge/:docId updates a document", async () => {
    const doc = manager.addKnowledgeDocument(agentId, { filename: "update-me.txt", file_type: "txt" });
    const res = await request(app, "PUT", `/api/agents/${agentId}/knowledge/${doc.id}`, {
      filename: "updated.txt",
      priority: 95,
    });
    expect(res.status).toBe(200);
    expect(res.body.filename).toBe("updated.txt");
    expect(res.body.priority).toBe(95);
  });

  test("POST /:id/knowledge/:docId/archive soft-deletes", async () => {
    const doc = manager.addKnowledgeDocument(agentId, { filename: "archive-me.txt", file_type: "txt" });
    const res = await request(app, "POST", `/api/agents/${agentId}/knowledge/${doc.id}/archive`);
    expect(res.status).toBe(200);
    expect(res.body.is_deleted).toBe(1);
  });

  test("POST /:id/knowledge/:docId/restore undeletes", async () => {
    const doc = manager.addKnowledgeDocument(agentId, { filename: "restore-me.txt", file_type: "txt" });
    manager.softDeleteDocument(doc.id);
    const res = await request(app, "POST", `/api/agents/${agentId}/knowledge/${doc.id}/restore`);
    expect(res.status).toBe(200);
    expect(res.body.is_deleted).toBe(0);
  });

  test("GET /:id/kb/stats returns KB health stats", async () => {
    const res = await request(app, "GET", `/api/agents/${agentId}/kb/stats`);
    expect(res.status).toBe(200);
    expect(typeof res.body.documentCount).toBe("number");
    expect(typeof res.body.webSourceCount).toBe("number");
    expect(typeof res.body.totalSizeBytes).toBe("number");
  });

  test("GET /:id/kb/coverage returns coverage analysis", async () => {
    const res = await request(app, "GET", `/api/agents/${agentId}/kb/coverage`);
    expect(res.status).toBe(200);
    expect(typeof res.body.coverageScore).toBe("number");
    expect(typeof res.body.gapSummary).toBe("string");
  });

  test("POST /:id/kb/populate-from-research populates KB", async () => {
    const res = await request(app, "POST", `/api/agents/${agentId}/kb/populate-from-research`, {
      jobId: "rj-route-1",
      sources: [
        { url: "https://example.com/a", title: "Good Source", text: "content", composite: 0.8 },
        { url: "https://example.com/b", title: "Bad Source", text: "content", composite: 0.3 },
      ],
      threshold: 0.65,
    });
    expect(res.status).toBe(200);
    expect(res.body.added).toBe(1);
    expect(res.body.skipped).toBe(1);
  });

  test("PUT /:id/sources/:sourceId updates web source", async () => {
    const src = manager.addWebSource(agentId, { url: "https://example.com", name: "Old" });
    const res = await request(app, "PUT", `/api/agents/${agentId}/sources/${src.id}`, {
      name: "Updated Name",
    });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Updated Name");
  });
});
