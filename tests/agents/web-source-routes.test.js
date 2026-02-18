/**
 * Web Source Refresh Routes — TDD tests
 * Verifies refresh endpoint for individual and bulk web source fetching.
 */

const { createTestDb } = require("../fixtures/test-db");
const { AgentManagerService } = require("../../src/agents/manager");
const { RAGPipeline } = require("../../src/rag");
const { DocumentParser } = require("../../src/rag/document-parser");
const { WebCrawler } = require("../../src/agents/web-crawler");
const { createAgentRoutes } = require("../../src/agents/routes");
const express = require("express");

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// HTTP test helper
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
          try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode, body: data }); }
        });
      });
      req.on("error", (err) => { server.close(); reject(err); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  });
}

describe("Web Source Refresh Routes", () => {
  let db, manager, rag, app, agentId;

  beforeAll(async () => {
    db = await createTestDb();
    manager = new AgentManagerService(db, jest.fn());
    rag = new RAGPipeline(manager, null);
    const documentParser = new DocumentParser();
    const webCrawler = new WebCrawler();

    const appExpress = express();
    appExpress.use(express.json());
    appExpress.use("/api/agents", createAgentRoutes(manager, null, { rag, documentParser, webCrawler }));
    app = appExpress;

    const agent = manager.createAgent({ name: "Web Source Agent", status: "active" });
    agentId = agent.id;
  });

  afterAll(() => { if (db) db.close(); });

  beforeEach(() => { mockFetch.mockReset(); });

  test("POST /:id/sources/:sourceId/refresh fetches and indexes content", async () => {
    const source = manager.addWebSource(agentId, {
      url: "https://example.com/dept",
      name: "Department Page",
    });

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([["content-type", "text/html"]]),
      text: async () => `<html><body><h1>Public Works</h1><p>Road maintenance and infrastructure services for Cleveland.</p></body></html>`,
    });

    const res = await request(app, "POST", `/api/agents/${agentId}/sources/${source.id}/refresh`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.chunksIndexed).toBeGreaterThanOrEqual(1);

    // Verify the content is searchable
    const results = rag.search.search(agentId, "road maintenance infrastructure", 5);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  test("POST /:id/sources/:sourceId/refresh handles fetch failure", async () => {
    const source = manager.addWebSource(agentId, {
      url: "https://down.example.com",
      name: "Down Site",
    });

    mockFetch.mockRejectedValue(new Error("Connection refused"));

    const res = await request(app, "POST", `/api/agents/${agentId}/sources/${source.id}/refresh`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toBeTruthy();
  });

  test("POST /:id/sources/:sourceId/refresh returns 404 for unknown source", async () => {
    const res = await request(app, "POST", `/api/agents/${agentId}/sources/nonexistent/refresh`);
    expect(res.status).toBe(404);
  });

  test("POST /:id/sources/refresh-all refreshes all stale sources", async () => {
    // Create sources — one stale, one fresh
    const stale = manager.addWebSource(agentId, {
      url: "https://example.com/stale-page",
      name: "Stale Page",
      refresh_interval_hours: 1,
      auto_refresh: 1,
    });
    // Manually set last_refreshed to 2 hours ago
    manager.updateWebSource(stale.id, {
      last_refreshed: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    });

    const fresh = manager.addWebSource(agentId, {
      url: "https://example.com/fresh-page",
      name: "Fresh Page",
      refresh_interval_hours: 24,
      auto_refresh: 1,
    });
    manager.updateWebSource(fresh.id, {
      last_refreshed: new Date().toISOString(),
    });

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([["content-type", "text/html"]]),
      text: async () => `<html><body><p>Refreshed content for stale page.</p></body></html>`,
    });

    const res = await request(app, "POST", `/api/agents/${agentId}/sources/refresh-all`);
    expect(res.status).toBe(200);
    expect(res.body.refreshed).toBeGreaterThanOrEqual(1);
    expect(res.body.skipped).toBeGreaterThanOrEqual(1);
  });

  test("POST /:id/sources creates source and optionally indexes immediately", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([["content-type", "text/html"]]),
      text: async () => `<html><body><p>New source about budget planning.</p></body></html>`,
    });

    const res = await request(app, "POST", `/api/agents/${agentId}/sources`, {
      url: "https://example.com/budget",
      name: "Budget Info",
      auto_refresh: 1,
      fetch_now: true,
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
  });
});
