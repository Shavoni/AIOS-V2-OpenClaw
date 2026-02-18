/**
 * MANUS Ingest Routes — TDD tests
 * Verifies API endpoints for MANUS file ingest and batch operations.
 */

const { createTestDb } = require("../fixtures/test-db");
const { AgentManagerService } = require("../../src/agents/manager");
const { RAGPipeline } = require("../../src/rag");
const { DocumentParser } = require("../../src/rag/document-parser");
const { ManusIngestService } = require("../../src/agents/manus-ingest");
const { createAgentRoutes } = require("../../src/agents/routes");
const express = require("express");

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

describe("MANUS Ingest Routes", () => {
  let db, manager, rag, app, agentId;

  beforeAll(async () => {
    db = await createTestDb();
    manager = new AgentManagerService(db, jest.fn());
    rag = new RAGPipeline(manager, null);
    const parser = new DocumentParser();
    const manusIngest = new ManusIngestService({ agentManager: manager, rag, documentParser: parser });

    const appExpress = express();
    appExpress.use(express.json({ limit: "10mb" }));
    appExpress.use("/api/agents", createAgentRoutes(manager, null, { rag, documentParser: parser, manusIngest }));
    app = appExpress;

    const agent = manager.createAgent({ name: "Route Agent", domain: "engineering", status: "active" });
    agentId = agent.id;
  });

  afterAll(() => { if (db) db.close(); });

  test("POST /:id/ingest-manus ingests single file", async () => {
    const res = await request(app, "POST", `/api/agents/${agentId}/ingest-manus`, {
      filename: "route-test.md",
      file_type: "md",
      content: "# Route Test\n\nVerifying MANUS ingest via HTTP endpoint.",
    });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.document.source_type).toBe("manus_research");
    expect(res.body.document.priority).toBe(80);
    expect(res.body.chunksIndexed).toBeGreaterThanOrEqual(1);
  });

  test("POST /:id/ingest-manus/batch ingests multiple files", async () => {
    const res = await request(app, "POST", `/api/agents/${agentId}/ingest-manus/batch`, {
      files: [
        { filename: "b1.txt", file_type: "txt", content: "Batch document one about engineering standards." },
        { filename: "b2.txt", file_type: "txt", content: "Batch document two about code review practices." },
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.succeeded).toBe(2);
  });

  test("POST /:id/ingest-manus returns 400 for missing content", async () => {
    const res = await request(app, "POST", `/api/agents/${agentId}/ingest-manus`, {
      filename: "no-content.txt",
      file_type: "txt",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  test("POST /:id/ingest-manus/batch returns 400 for missing files", async () => {
    const res = await request(app, "POST", `/api/agents/${agentId}/ingest-manus/batch`, {});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("files");
  });

  test("POST /ingest-manus/route auto-routes file to matching agent", async () => {
    const res = await request(app, "POST", `/api/agents/ingest-manus/route`, {
      filename: "engineering-docs.md",
      file_type: "md",
      content: "# Engineering Standards\n\nCode review and engineering best practices.",
      agent_id: agentId,
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.routed_to_agent_id).toBe(agentId);
  });

  test("POST /:id/ingest-manus supports base64 encoding", async () => {
    const original = "Base64 encoded MANUS research output about infrastructure.";
    const b64 = Buffer.from(original).toString("base64");

    const res = await request(app, "POST", `/api/agents/${agentId}/ingest-manus`, {
      filename: "encoded.txt",
      file_type: "txt",
      content: b64,
      encoding: "base64",
    });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
  });
});
