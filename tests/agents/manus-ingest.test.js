/**
 * MANUS Ingest — TDD tests
 * Verifies single file ingest, batch ingest, priority boost, source tagging,
 * base64 binary support, domain auto-routing, and error handling.
 */

const { createTestDb } = require("../fixtures/test-db");
const { AgentManagerService } = require("../../src/agents/manager");
const { RAGPipeline } = require("../../src/rag");
const { DocumentParser } = require("../../src/rag/document-parser");
const { ManusIngestService } = require("../../src/agents/manus-ingest");

describe("ManusIngestService", () => {
  let db, manager, rag, parser, ingest, agentId;

  beforeAll(async () => {
    db = await createTestDb();
    manager = new AgentManagerService(db, jest.fn());
    rag = new RAGPipeline(manager, null);
    parser = new DocumentParser();
    ingest = new ManusIngestService({ agentManager: manager, rag, documentParser: parser });

    const agent = manager.createAgent({
      name: "MANUS Test Agent",
      domain: "public-safety",
      status: "active",
    });
    agentId = agent.id;
  });

  afterAll(() => { if (db) db.close(); });

  // --- Single file ingest ---
  test("ingestFile creates KB document with manus_research source_type", async () => {
    const result = await ingest.ingestFile(agentId, {
      filename: "safety-report.md",
      file_type: "md",
      content: "# Safety Report\n\nCrime statistics decreased 15% in downtown Cleveland.",
    });

    expect(result.ok).toBe(true);
    expect(result.document.id).toBeTruthy();
    expect(result.document.source_type).toBe("manus_research");
    expect(result.document.added_by).toBe("manus");
  });

  test("ingestFile assigns priority 80 by default for MANUS docs", async () => {
    const result = await ingest.ingestFile(agentId, {
      filename: "priority-test.txt",
      file_type: "txt",
      content: "High priority MANUS research content.",
    });

    expect(result.document.priority).toBe(80);
  });

  test("ingestFile allows custom priority override", async () => {
    const result = await ingest.ingestFile(agentId, {
      filename: "custom-priority.txt",
      file_type: "txt",
      content: "Custom priority content.",
      priority: 95,
    });

    expect(result.document.priority).toBe(95);
  });

  test("ingestFile parses content through DocumentParser", async () => {
    const result = await ingest.ingestFile(agentId, {
      filename: "report.html",
      file_type: "html",
      content: "<html><body><h1>Budget</h1><p>Annual budget allocation for transit.</p><script>x</script></body></html>",
    });

    expect(result.ok).toBe(true);
    // Verify HTML was parsed — searchable without tags
    const results = rag.search.search(agentId, "budget allocation transit", 5);
    expect(results.length).toBeGreaterThanOrEqual(1);
    const match = results.find(r => r.text.includes("budget"));
    expect(match).toBeTruthy();
    expect(match.text).not.toContain("<script>");
  });

  test("ingestFile indexes content into RAG and returns chunk count", async () => {
    const result = await ingest.ingestFile(agentId, {
      filename: "indexable.txt",
      file_type: "txt",
      content: "Comprehensive analysis of public transportation routes in Cuyahoga County.",
    });

    expect(result.chunksIndexed).toBeGreaterThanOrEqual(1);
    const results = rag.search.search(agentId, "Cuyahoga County transportation", 5);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  test("ingestFile handles base64-encoded content", async () => {
    const original = "Encoded research data about water treatment infrastructure.";
    const b64 = Buffer.from(original).toString("base64");

    const result = await ingest.ingestFile(agentId, {
      filename: "encoded.txt",
      file_type: "txt",
      content: b64,
      encoding: "base64",
    });

    expect(result.ok).toBe(true);
    const results = rag.search.search(agentId, "water treatment infrastructure", 5);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  test("ingestFile stores parsed content in metadata for restart re-indexing", async () => {
    const result = await ingest.ingestFile(agentId, {
      filename: "persist-test.txt",
      file_type: "txt",
      content: "Content that must survive server restart.",
    });

    const doc = manager.getKnowledgeDocument(result.document.id);
    const meta = typeof doc.metadata === "string" ? JSON.parse(doc.metadata) : (doc.metadata || {});
    expect(meta.content).toContain("survive server restart");
  });

  test("ingestFile rejects empty content", async () => {
    const result = await ingest.ingestFile(agentId, {
      filename: "empty.txt",
      file_type: "txt",
      content: "",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("content");
  });

  test("ingestFile rejects missing filename", async () => {
    const result = await ingest.ingestFile(agentId, {
      file_type: "txt",
      content: "Some content.",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("filename");
  });

  // --- Batch ingest ---
  test("ingestBatch processes multiple files and returns per-file results", async () => {
    const results = await ingest.ingestBatch(agentId, {
      files: [
        { filename: "batch-1.md", file_type: "md", content: "# Batch File One\n\nFirst document about fleet management." },
        { filename: "batch-2.csv", file_type: "csv", content: "vehicle,status\nEngine 5,Active\nLadder 12,Maintenance" },
        { filename: "batch-3.txt", file_type: "txt", content: "Third document covering dispatch protocols." },
      ],
    });

    expect(results.total).toBe(3);
    expect(results.succeeded).toBe(3);
    expect(results.failed).toBe(0);
    expect(results.documents).toHaveLength(3);
    expect(results.documents.every(d => d.ok)).toBe(true);
  });

  test("ingestBatch continues on individual file failure", async () => {
    const results = await ingest.ingestBatch(agentId, {
      files: [
        { filename: "good.txt", file_type: "txt", content: "Valid content here." },
        { file_type: "txt", content: "Missing filename." }, // should fail
        { filename: "also-good.txt", file_type: "txt", content: "Another valid file." },
      ],
    });

    expect(results.total).toBe(3);
    expect(results.succeeded).toBe(2);
    expect(results.failed).toBe(1);
  });

  test("ingestBatch applies priority to all files", async () => {
    const results = await ingest.ingestBatch(agentId, {
      files: [
        { filename: "p1.txt", file_type: "txt", content: "Priority file one." },
        { filename: "p2.txt", file_type: "txt", content: "Priority file two." },
      ],
      priority: 90,
    });

    expect(results.documents[0].document.priority).toBe(90);
    expect(results.documents[1].document.priority).toBe(90);
  });

  test("ingestBatch rejects empty files array", async () => {
    const results = await ingest.ingestBatch(agentId, { files: [] });
    expect(results.total).toBe(0);
    expect(results.succeeded).toBe(0);
  });

  // --- Metadata tagging ---
  test("ingestFile attaches manus_job_id when provided", async () => {
    const result = await ingest.ingestFile(agentId, {
      filename: "job-tagged.txt",
      file_type: "txt",
      content: "Research from specific MANUS job.",
      manus_job_id: "manus-job-42",
    });

    const doc = manager.getKnowledgeDocument(result.document.id);
    const meta = typeof doc.metadata === "string" ? JSON.parse(doc.metadata) : (doc.metadata || {});
    expect(meta.manus_job_id).toBe("manus-job-42");
  });

  test("ingestFile attaches custom tags when provided", async () => {
    const result = await ingest.ingestFile(agentId, {
      filename: "tagged.txt",
      file_type: "txt",
      content: "Tagged research content.",
      tags: ["quarterly-review", "2026-Q1"],
    });

    const doc = manager.getKnowledgeDocument(result.document.id);
    const meta = typeof doc.metadata === "string" ? JSON.parse(doc.metadata) : (doc.metadata || {});
    expect(meta.tags).toEqual(["quarterly-review", "2026-Q1"]);
  });

  // --- Domain auto-routing ---
  test("routeAndIngest matches file to agent by domain keywords", async () => {
    // Create agents with distinct domains
    const safetyAgent = manager.createAgent({ name: "Safety Agent", domain: "public-safety", status: "active" });
    const financeAgent = manager.createAgent({ name: "Finance Agent", domain: "finance", status: "active" });

    const result = await ingest.routeAndIngest({
      filename: "crime-stats.md",
      file_type: "md",
      content: "# Crime Statistics\n\nPublic safety metrics for Q4 including arrest records and response times.",
    });

    expect(result.ok).toBe(true);
    expect(result.routed_to_agent_id).toBe(safetyAgent.id);
  });

  test("routeAndIngest returns error when no matching agent found", async () => {
    const result = await ingest.routeAndIngest({
      filename: "alien-report.txt",
      file_type: "txt",
      content: "Extraterrestrial contact protocols for deep space missions.",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("No matching agent");
  });

  test("routeAndIngest accepts explicit agent_id override", async () => {
    const result = await ingest.routeAndIngest({
      filename: "override.txt",
      file_type: "txt",
      content: "Content routed to specific agent.",
      agent_id: agentId,
    });

    expect(result.ok).toBe(true);
    expect(result.routed_to_agent_id).toBe(agentId);
  });

  // --- Stats ---
  test("getIngestStats returns count of MANUS-sourced documents", () => {
    const stats = ingest.getIngestStats(agentId);
    expect(stats.manusDocuments).toBeGreaterThanOrEqual(1);
    expect(typeof stats.totalChunks).toBe("number");
  });
});
