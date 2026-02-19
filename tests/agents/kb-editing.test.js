/**
 * KB Editing — TDD tests
 * Knowledge base documents can be updated, re-prioritized,
 * content replaced, and re-indexed after initial creation.
 */

const { createTestDb } = require("../fixtures/test-db");
const { AgentManagerService } = require("../../src/agents/manager");
const { RAGPipeline } = require("../../src/rag");

describe("KB Editing", () => {
  let db, manager, rag, agentId;

  beforeAll(async () => {
    db = await createTestDb();
    manager = new AgentManagerService(db, jest.fn());
    rag = new RAGPipeline(manager, null);

    const agent = manager.createAgent({
      name: "KB Edit Test Agent",
      domain: "public-safety",
      status: "active",
    });
    agentId = agent.id;
  });

  afterAll(() => { if (db) db.close(); });

  test("updateKnowledgeDocument changes filename", () => {
    const doc = manager.addKnowledgeDocument(agentId, {
      filename: "original-name.md",
      file_type: "md",
    });

    const updated = manager.updateKnowledgeDocument(doc.id, {
      filename: "renamed-document.md",
    });

    expect(updated.filename).toBe("renamed-document.md");
  });

  test("updateKnowledgeDocument changes priority", () => {
    const doc = manager.addKnowledgeDocument(agentId, {
      filename: "priority-test.md",
      file_type: "md",
      priority: 50,
    });

    const updated = manager.updateKnowledgeDocument(doc.id, {
      priority: 95,
    });

    expect(updated.priority).toBe(95);
  });

  test("updateKnowledgeDocument changes source_type", () => {
    const doc = manager.addKnowledgeDocument(agentId, {
      filename: "source-test.md",
      file_type: "md",
      source_type: "manual_entry",
    });

    const updated = manager.updateKnowledgeDocument(doc.id, {
      source_type: "manus_research",
    });

    expect(updated.source_type).toBe("manus_research");
  });

  test("updateKnowledgeDocument replaces metadata content", () => {
    const doc = manager.addKnowledgeDocument(agentId, {
      filename: "content-replace.md",
      file_type: "md",
      metadata: { content: "Original content about water systems." },
    });

    const updated = manager.updateKnowledgeDocument(doc.id, {
      metadata: { content: "Updated content about sewer infrastructure." },
    });

    expect(updated.metadata.content).toBe("Updated content about sewer infrastructure.");
  });

  test("updateKnowledgeDocument sets updated_at timestamp", () => {
    const doc = manager.addKnowledgeDocument(agentId, {
      filename: "timestamp-test.md",
      file_type: "md",
    });

    const before = doc.updated_at || doc.uploaded_at;

    // Small delay to ensure timestamp changes
    const updated = manager.updateKnowledgeDocument(doc.id, {
      priority: 80,
    });

    expect(updated.updated_at).toBeTruthy();
  });

  test("updateKnowledgeDocument returns null for non-existent doc", () => {
    const result = manager.updateKnowledgeDocument("non-existent-id", {
      filename: "nope.md",
    });

    expect(result).toBeNull();
  });

  test("updated content can be re-indexed into RAG", () => {
    const doc = manager.addKnowledgeDocument(agentId, {
      filename: "reindex-test.md",
      file_type: "md",
      metadata: { content: "Original fire department procedures." },
    });

    // Index original content
    rag.indexDocument(agentId, doc.id, "Original fire department procedures.", {
      filename: "reindex-test.md",
    });

    // Update content
    const newContent = "Updated emergency medical services dispatch protocol for Cuyahoga County.";
    manager.updateKnowledgeDocument(doc.id, {
      metadata: { content: newContent },
    });

    // Re-index with new content
    rag.indexDocument(agentId, doc.id, newContent, {
      filename: "reindex-test.md",
    });

    // Search should find updated content
    const results = rag.search.search(agentId, "Cuyahoga County emergency medical", 5);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  test("softDeleteDocument marks doc as deleted without removing it", () => {
    const doc = manager.addKnowledgeDocument(agentId, {
      filename: "soft-delete-test.md",
      file_type: "md",
    });

    const deleted = manager.softDeleteDocument(doc.id);
    expect(deleted.is_deleted).toBe(1);
    expect(deleted.deleted_at).toBeTruthy();

    // Should not appear in default listing
    const docs = manager.listKnowledgeDocuments(agentId);
    const found = docs.find(d => d.id === doc.id);
    expect(found).toBeUndefined();
  });

  test("restoreDocument brings back soft-deleted doc", () => {
    const doc = manager.addKnowledgeDocument(agentId, {
      filename: "restore-test.md",
      file_type: "md",
    });

    manager.softDeleteDocument(doc.id);
    const restored = manager.restoreDocument(doc.id);

    expect(restored.is_deleted).toBe(0);
    expect(restored.deleted_at).toBeNull();

    // Should appear in default listing again
    const docs = manager.listKnowledgeDocuments(agentId);
    const found = docs.find(d => d.id === doc.id);
    expect(found).toBeTruthy();
  });

  test("listKnowledgeDocuments with includeDeleted shows soft-deleted docs", () => {
    const doc = manager.addKnowledgeDocument(agentId, {
      filename: "include-deleted-test.md",
      file_type: "md",
    });

    manager.softDeleteDocument(doc.id);

    const withDeleted = manager.listKnowledgeDocuments(agentId, { includeDeleted: true });
    const found = withDeleted.find(d => d.id === doc.id);
    expect(found).toBeTruthy();
    expect(found.is_deleted).toBe(1);
  });

  test("hardDeleteDocument permanently removes the doc", () => {
    const doc = manager.addKnowledgeDocument(agentId, {
      filename: "hard-delete-test.md",
      file_type: "md",
    });

    manager.hardDeleteDocument(doc.id);

    const result = manager.getKnowledgeDocument(doc.id);
    expect(result).toBeNull();
  });

  test("batchDeleteDocuments soft-deletes multiple docs at once", () => {
    const doc1 = manager.addKnowledgeDocument(agentId, { filename: "batch-1.md", file_type: "md" });
    const doc2 = manager.addKnowledgeDocument(agentId, { filename: "batch-2.md", file_type: "md" });

    const result = manager.batchDeleteDocuments([doc1.id, doc2.id]);
    expect(result.deleted).toBe(2);

    const d1 = manager.getKnowledgeDocument(doc1.id);
    const d2 = manager.getKnowledgeDocument(doc2.id);
    expect(d1.is_deleted).toBe(1);
    expect(d2.is_deleted).toBe(1);
  });
});
