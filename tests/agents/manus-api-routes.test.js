/**
 * MANUS Routes — TDD tests
 * Tests for /manus/research, /manus/tasks, /manus/ingest-session, /manus/status
 */

const express = require("express");
const { createManusRoutes } = require("../../src/agents/manus-routes");
const { createTestDb } = require("../fixtures/test-db");
const { AgentManagerService } = require("../../src/agents/manager");
const { RAGPipeline } = require("../../src/rag");
const { DocumentParser } = require("../../src/rag/document-parser");
const { ManusIngestService } = require("../../src/agents/manus-ingest");
const { ManusSessionIngest } = require("../../src/agents/manus-session-ingest");
const { EventEmitter } = require("events");
const path = require("path");
const fs = require("fs");
const os = require("os");

// Lightweight supertest replacement
function makeApp(router) {
  const app = express();
  app.use(express.json());
  app.use("/manus", router);
  return app;
}

async function request(app, method, url, body) {
  return new Promise((resolve, reject) => {
    const http = require("http");
    const server = app.listen(0, () => {
      const port = server.address().port;
      const opts = {
        hostname: "127.0.0.1",
        port,
        path: url,
        method: method.toUpperCase(),
        headers: { "Content-Type": "application/json" },
      };

      const req = http.request(opts, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
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

describe("MANUS Routes", () => {
  let db, manager, rag, parser, manusIngest, sessionIngest, eventBus, app;

  beforeAll(async () => {
    db = await createTestDb();
    manager = new AgentManagerService(db, jest.fn());
    rag = new RAGPipeline(manager, null);
    parser = new DocumentParser();
    manusIngest = new ManusIngestService({ agentManager: manager, rag, documentParser: parser });
    sessionIngest = new ManusSessionIngest({ agentManager: manager, rag, documentParser: parser });
    eventBus = new EventEmitter();

    const router = createManusRoutes({ manusIngest, sessionIngest, agentManager: manager, rag, eventBus });
    app = makeApp(router);
  });

  afterAll(() => { if (db) db.close(); });

  // --- POST /manus/research ---
  test("POST /manus/research returns 400 without prompt", async () => {
    const res = await request(app, "POST", "/manus/research", {});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("prompt");
  });

  test("POST /manus/research returns 500 without MANUS_API_KEY", async () => {
    const origKey = process.env.MANUS_API_KEY;
    delete process.env.MANUS_API_KEY;

    const res = await request(app, "POST", "/manus/research", { prompt: "test" });
    expect(res.status).toBe(500);
    expect(res.body.error).toContain("MANUS_API_KEY");

    if (origKey) process.env.MANUS_API_KEY = origKey;
  });

  // --- GET /manus/status ---
  test("GET /manus/status returns configured:false without key", async () => {
    const origKey = process.env.MANUS_API_KEY;
    delete process.env.MANUS_API_KEY;

    const res = await request(app, "GET", "/manus/status");
    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(false);

    if (origKey) process.env.MANUS_API_KEY = origKey;
  });

  // --- POST /manus/ingest-session ---
  test("POST /manus/ingest-session returns 400 without directoryPath", async () => {
    const res = await request(app, "POST", "/manus/ingest-session", {});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("directoryPath");
  });

  test("POST /manus/ingest-session returns 400 for non-existent directory", async () => {
    const res = await request(app, "POST", "/manus/ingest-session", {
      directoryPath: "/nonexistent/path/abc123",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("not found");
  });

  test("POST /manus/ingest-session provisions agents from valid directory", async () => {
    // Create temp MANUS directory
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "manus-route-test-"));
    const gpt = path.join(tmpDir, "1. GPT_01_Test_Agent");
    const inner = path.join(gpt, "GPT_01_Test_Agent");
    const kb = path.join(inner, "knowledge_base");
    fs.mkdirSync(kb, { recursive: true });
    fs.writeFileSync(path.join(inner, "description.md"), "Test Agent — route test");
    fs.writeFileSync(path.join(inner, "instructions.md"), "# Instructions\n\nYou are a test agent.");
    fs.writeFileSync(path.join(kb, "01_test.md"), "# Test Doc\n\nContent for testing.");

    try {
      const res = await request(app, "POST", "/manus/ingest-session", {
        directoryPath: tmpDir,
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.agentsCreated).toBe(1);
      expect(res.body.totalKBEntriesCreated).toBeGreaterThanOrEqual(1);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // --- POST /manus/ingest-session/preview ---
  test("POST /manus/ingest-session/preview returns manifest without creating agents", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "manus-preview-test-"));
    const gpt = path.join(tmpDir, "1. GPT_01_Preview_Agent");
    const inner = path.join(gpt, "GPT_01_Preview_Agent");
    const kb = path.join(inner, "knowledge_base");
    fs.mkdirSync(kb, { recursive: true });
    fs.writeFileSync(path.join(inner, "description.md"), "Preview Agent — dry run test");
    fs.writeFileSync(path.join(inner, "instructions.md"), "# Instructions\n\nPreview only.");
    fs.writeFileSync(path.join(kb, "01_preview.md"), "# Preview\n\nContent.");

    try {
      const agentsBefore = manager.listAgents().length;

      const res = await request(app, "POST", "/manus/ingest-session/preview", {
        directoryPath: tmpDir,
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.validFolders).toBe(1);
      expect(res.body.totalKBFiles).toBeGreaterThanOrEqual(1);

      // Should NOT create any agents
      const agentsAfter = manager.listAgents().length;
      expect(agentsAfter).toBe(agentsBefore);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
