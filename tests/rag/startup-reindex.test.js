/**
 * RAG Startup Re-index — TDD tests
 * Verifies that agent KB documents are re-indexed into the in-memory
 * keyword search on pipeline initialization (simulating a server restart).
 */

const { createTestDb } = require("../fixtures/test-db");
const { AgentManagerService } = require("../../src/agents/manager");
const { RAGPipeline } = require("../../src/rag");

describe("RAG Startup Re-index", () => {
  let db, manager;

  beforeAll(async () => {
    db = await createTestDb();
    manager = new AgentManagerService(db, jest.fn());
  });

  afterAll(() => { if (db) db.close(); });

  test("reindexAgentDocuments loads all active KB docs into keyword index", () => {
    // Simulate pre-existing agent with documents in DB (as if from a previous server session)
    const agent = manager.createAgent({ name: "Reindex Agent", status: "active" });

    // Insert documents directly into DB (simulating prior session)
    const { v4: uuidv4 } = require("uuid");
    const docId1 = uuidv4();
    const docId2 = uuidv4();

    db.run(
      `INSERT INTO knowledge_documents (id, agent_id, filename, file_type, file_size, status, is_deleted, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [docId1, agent.id, "policy.md", "md", 500, "active", 0, JSON.stringify({ content: "# Employee Benefits\n\nAll employees are entitled to health insurance, dental coverage, and 401k matching." })]
    );
    db.run(
      `INSERT INTO knowledge_documents (id, agent_id, filename, file_type, file_size, status, is_deleted, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [docId2, agent.id, "handbook.txt", "txt", 300, "active", 0, JSON.stringify({ content: "Employee handbook covering vacation policy, sick leave, and remote work guidelines." })]
    );

    // Create a fresh RAG pipeline (simulating server restart — empty in-memory index)
    const rag = new RAGPipeline(manager, null);

    // Before reindex: keyword search should return nothing
    const beforeResults = rag.search.search(agent.id, "employee benefits", 5);
    expect(beforeResults.length).toBe(0);

    // Run the reindex
    const stats = rag.reindexAgentDocuments();

    // After reindex: keyword search should find the documents
    const afterResults = rag.search.search(agent.id, "employee benefits", 5);
    expect(afterResults.length).toBeGreaterThanOrEqual(1);

    // Stats should report what was indexed
    expect(stats.agentsIndexed).toBeGreaterThanOrEqual(1);
    expect(stats.documentsIndexed).toBeGreaterThanOrEqual(2);
    expect(stats.chunksCreated).toBeGreaterThanOrEqual(2);
  });

  test("reindexAgentDocuments skips soft-deleted documents", () => {
    const agent = manager.createAgent({ name: "Deleted Doc Agent", status: "active" });

    const { v4: uuidv4 } = require("uuid");
    const docId = uuidv4();

    // Insert a soft-deleted document
    db.run(
      `INSERT INTO knowledge_documents (id, agent_id, filename, file_type, file_size, status, is_deleted, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [docId, agent.id, "deleted.txt", "txt", 100, "active", 1, JSON.stringify({ content: "This content should not be indexed because the document is soft-deleted." })]
    );

    const rag = new RAGPipeline(manager, null);
    rag.reindexAgentDocuments();

    const results = rag.search.search(agent.id, "soft-deleted content", 5);
    expect(results.length).toBe(0);
  });

  test("reindexAgentDocuments handles documents without content in metadata gracefully", () => {
    const agent = manager.createAgent({ name: "No Content Agent", status: "active" });

    const { v4: uuidv4 } = require("uuid");
    db.run(
      `INSERT INTO knowledge_documents (id, agent_id, filename, file_type, file_size, status, is_deleted, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), agent.id, "empty.txt", "txt", 0, "active", 0, "{}"]
    );

    const rag = new RAGPipeline(manager, null);

    // Should not throw
    const stats = rag.reindexAgentDocuments();
    expect(stats).toBeTruthy();
    expect(stats.documentsIndexed).toBeGreaterThanOrEqual(0);
  });

  test("reindexAgentDocuments indexes content from metadata.content field", () => {
    const agent = manager.createAgent({ name: "Content Agent", status: "active" });

    const { v4: uuidv4 } = require("uuid");
    db.run(
      `INSERT INTO knowledge_documents (id, agent_id, filename, file_type, file_size, status, is_deleted, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), agent.id, "specific.txt", "txt", 200, "active", 0,
       JSON.stringify({ content: "Kubernetes cluster autoscaling configuration for production workloads." })]
    );

    const rag = new RAGPipeline(manager, null);
    rag.reindexAgentDocuments();

    const results = rag.search.search(agent.id, "kubernetes autoscaling", 5);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].text).toContain("Kubernetes");
  });

  test("reindexAgentDocuments returns zero stats when no documents exist", () => {
    const agent = manager.createAgent({ name: "Empty KB Agent", status: "active" });

    const rag = new RAGPipeline(manager, null);
    const stats = rag.reindexAgentDocuments();

    expect(stats.agentsIndexed).toBeGreaterThanOrEqual(0);
    expect(stats.documentsIndexed).toBeGreaterThanOrEqual(0);
  });
});
