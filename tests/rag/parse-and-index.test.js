/**
 * Parse-and-Index integration — TDD tests
 * Verifies that uploading documents with content triggers parsing and RAG indexing.
 */

const { createTestDb } = require("../fixtures/test-db");
const { AgentManagerService } = require("../../src/agents/manager");
const { RAGPipeline } = require("../../src/rag");
const { DocumentParser } = require("../../src/rag/document-parser");
const { createAgentRoutes } = require("../../src/agents/routes");
const express = require("express");

// Tiny HTTP test helper
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

describe("Parse-and-Index Integration", () => {
  let db, manager, rag, parser, app, agentId;

  beforeAll(async () => {
    db = await createTestDb();
    manager = new AgentManagerService(db, jest.fn());
    rag = new RAGPipeline(manager, null);
    parser = new DocumentParser();

    const appExpress = express();
    appExpress.use(express.json({ limit: "10mb" }));
    appExpress.use("/api/agents", createAgentRoutes(manager, null, { rag, documentParser: parser }));
    app = appExpress;

    const agent = manager.createAgent({ name: "Parse Test Agent", status: "active" });
    agentId = agent.id;
  });

  afterAll(() => { if (db) db.close(); });

  test("uploading txt content parses and indexes into RAG", async () => {
    const res = await request(app, "POST", `/api/agents/${agentId}/knowledge`, {
      filename: "readme.txt",
      file_type: "txt",
      file_size: 100,
      content: "AIOS V2 is an AI operating system for enterprise governance.",
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();

    // Verify content is searchable via RAG
    const results = rag.search.search(agentId, "AI operating system governance", 5);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  test("uploading markdown content strips frontmatter and indexes body", async () => {
    const res = await request(app, "POST", `/api/agents/${agentId}/knowledge`, {
      filename: "policy.md",
      file_type: "md",
      content: `---
title: Security Policy
---

# Access Control

All employees must use multi-factor authentication for system access.`,
    });
    expect(res.status).toBe(201);

    const results = rag.search.search(agentId, "multi-factor authentication", 5);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  test("uploading HTML content strips tags and indexes text", async () => {
    const res = await request(app, "POST", `/api/agents/${agentId}/knowledge`, {
      filename: "page.html",
      file_type: "html",
      content: `<html><body><h1>Benefits</h1><p>Dental coverage and vision insurance for all staff.</p><script>alert('x')</script></body></html>`,
    });
    expect(res.status).toBe(201);

    const results = rag.search.search(agentId, "dental coverage vision", 5);
    expect(results.length).toBeGreaterThanOrEqual(1);
    // Should not contain HTML tags in indexed text
    const match = results.find(r => r.text.includes("Dental"));
    expect(match).toBeTruthy();
    expect(match.text).not.toContain("<h1>");
  });

  test("uploading CSV content converts to readable text and indexes", async () => {
    const res = await request(app, "POST", `/api/agents/${agentId}/knowledge`, {
      filename: "employees.csv",
      file_type: "csv",
      content: "name,department,role\nAlice,Engineering,Lead\nBob,Marketing,Manager",
    });
    expect(res.status).toBe(201);

    const results = rag.search.search(agentId, "Engineering Lead Alice", 5);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  test("uploading JSON content indexes pretty-printed text", async () => {
    const res = await request(app, "POST", `/api/agents/${agentId}/knowledge`, {
      filename: "config.json",
      file_type: "json",
      content: JSON.stringify({ database: "postgres", replication: "enabled", shards: 3 }),
    });
    expect(res.status).toBe(201);

    const results = rag.search.search(agentId, "postgres replication", 5);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  test("uploading without content still creates document record", async () => {
    const res = await request(app, "POST", `/api/agents/${agentId}/knowledge`, {
      filename: "empty.txt",
      file_type: "txt",
      file_size: 0,
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
  });

  test("docx file type is allowed in upload", async () => {
    const res = await request(app, "POST", `/api/agents/${agentId}/knowledge`, {
      filename: "report.docx",
      file_type: "docx",
      file_size: 500,
      content: "This is pre-extracted docx text about quarterly revenue.",
    });
    expect(res.status).toBe(201);

    const results = rag.search.search(agentId, "quarterly revenue", 5);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  test("chunk_count is updated on document after indexing", async () => {
    const longContent = Array(20).fill("Cleveland public safety department handles emergency response coordination across all city districts.").join("\n\n");
    const res = await request(app, "POST", `/api/agents/${agentId}/knowledge`, {
      filename: "long-doc.txt",
      file_type: "txt",
      content: longContent,
    });
    expect(res.status).toBe(201);
    // The document should have chunk_count set
    expect(res.body.chunk_count).toBeGreaterThanOrEqual(1);
  });
});
