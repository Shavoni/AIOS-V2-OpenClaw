/**
 * Per-Agent Knowledge Base Architecture — Full TDD test suite
 * Covers: Bug fixes, schema additions, CRUD lifecycle, research-to-KB pipeline,
 * auto-builder integration, and priority-weighted retrieval.
 */

const { createTestDb } = require("../fixtures/test-db");
const { AgentManagerService } = require("../../src/agents/manager");

describe("Per-Agent Knowledge Base Architecture", () => {
  let db, manager;

  beforeAll(async () => {
    db = await createTestDb();
    manager = new AgentManagerService(db, jest.fn());
  });

  afterAll(() => {
    if (db) db.close();
  });

  // ─── Phase 1A: Bug Fix — RAG cleanup on document delete ─────────────

  describe("Phase 1A: RAG cleanup on delete", () => {
    let agentId;

    beforeAll(() => {
      const agent = manager.createAgent({ name: "RAG Test Agent", status: "active" });
      agentId = agent.id;
    });

    test("deleteKnowledgeDocument accepts optional RAG pipeline for cleanup", () => {
      const doc = manager.addKnowledgeDocument(agentId, {
        filename: "test.md",
        file_type: "md",
        file_size: 100,
      });

      const mockRag = {
        removeDocument: jest.fn(),
      };

      manager.deleteKnowledgeDocument(doc.id, { rag: mockRag, agentId });
      expect(mockRag.removeDocument).toHaveBeenCalledWith(agentId, doc.id);
    });

    test("deleteKnowledgeDocument works without RAG pipeline (backwards compatible)", () => {
      const doc = manager.addKnowledgeDocument(agentId, {
        filename: "test2.md",
        file_type: "md",
      });

      // Should not throw
      manager.deleteKnowledgeDocument(doc.id);
      const docs = manager.listKnowledgeDocuments(agentId);
      expect(docs.find(d => d.id === doc.id)).toBeUndefined();
    });

    test("deleteAgent cleans up embeddings via vectorStore if provided", () => {
      const tempAgent = manager.createAgent({ name: "Temp RAG Agent", status: "active" });
      const mockVectorStore = { deleteByAgent: jest.fn() };
      const mockRag = { search: { _index: new Map() }, removeDocument: jest.fn() };

      manager.deleteAgent(tempAgent.id, { vectorStore: mockVectorStore, rag: mockRag });
      expect(mockVectorStore.deleteByAgent).toHaveBeenCalledWith(tempAgent.id);
    });

    test("deleteAgent works without cleanup deps (backwards compatible)", () => {
      const tempAgent = manager.createAgent({ name: "Temp Agent 2", status: "active" });
      manager.deleteAgent(tempAgent.id);
      expect(manager.getAgent(tempAgent.id)).toBeNull();
    });
  });

  // ─── Phase 1B: Bug Fix — Research pipeline agentId ──────────────────

  describe("Phase 1B: Research pipeline agent_id", () => {
    test("research_jobs table has agent_id column", () => {
      // Insert a job with agent_id
      db.run(
        `INSERT INTO research_jobs (id, user_id, agent_id, query, status) VALUES (?, ?, ?, ?, ?)`,
        ["rj-test-1", "user-1", "agent-1", "test query", "QUEUED"]
      );
      const results = db.exec("SELECT agent_id FROM research_jobs WHERE id = 'rj-test-1'");
      expect(results.length).toBe(1);
      expect(results[0].values[0][0]).toBe("agent-1");
      // Cleanup
      db.run("DELETE FROM research_jobs WHERE id = 'rj-test-1'");
    });
  });

  // ─── Phase 2: Schema additions ──────────────────────────────────────

  describe("Phase 2: KB schema additions", () => {
    let agentId;

    beforeAll(() => {
      const agent = manager.createAgent({ name: "Schema Test Agent", status: "active" });
      agentId = agent.id;
    });

    test("knowledge_documents supports status column", () => {
      const doc = manager.addKnowledgeDocument(agentId, {
        filename: "status-test.txt",
        file_type: "txt",
        status: "active",
      });
      const docs = manager.listKnowledgeDocuments(agentId);
      const found = docs.find(d => d.filename === "status-test.txt");
      expect(found.status).toBe("active");
    });

    test("knowledge_documents supports added_by column", () => {
      const doc = manager.addKnowledgeDocument(agentId, {
        filename: "added-by-test.txt",
        file_type: "txt",
        added_by: "deep_research",
      });
      const docs = manager.listKnowledgeDocuments(agentId);
      const found = docs.find(d => d.filename === "added-by-test.txt");
      expect(found.added_by).toBe("deep_research");
    });

    test("knowledge_documents supports priority column", () => {
      const doc = manager.addKnowledgeDocument(agentId, {
        filename: "priority-test.txt",
        file_type: "txt",
        priority: 80,
      });
      const docs = manager.listKnowledgeDocuments(agentId);
      const found = docs.find(d => d.filename === "priority-test.txt");
      expect(found.priority).toBe(80);
    });

    test("knowledge_documents supports language column", () => {
      const doc = manager.addKnowledgeDocument(agentId, {
        filename: "lang-test.txt",
        file_type: "txt",
        language: "es",
      });
      const docs = manager.listKnowledgeDocuments(agentId);
      const found = docs.find(d => d.filename === "lang-test.txt");
      expect(found.language).toBe("es");
    });

    test("knowledge_documents supports is_deleted soft-delete flag", () => {
      const doc = manager.addKnowledgeDocument(agentId, {
        filename: "soft-del-test.txt",
        file_type: "txt",
      });
      const docs = manager.listKnowledgeDocuments(agentId);
      const found = docs.find(d => d.filename === "soft-del-test.txt");
      expect(found.is_deleted).toBe(0);
    });

    test("knowledge_documents supports source_type column", () => {
      const doc = manager.addKnowledgeDocument(agentId, {
        filename: "source-type-test.txt",
        file_type: "txt",
        source_type: "file_upload",
      });
      const docs = manager.listKnowledgeDocuments(agentId);
      const found = docs.find(d => d.filename === "source-type-test.txt");
      expect(found.source_type).toBe("file_upload");
    });

    test("knowledge_documents supports source_url column", () => {
      const doc = manager.addKnowledgeDocument(agentId, {
        filename: "url-source-test.txt",
        file_type: "txt",
        source_url: "https://example.com/doc",
      });
      const docs = manager.listKnowledgeDocuments(agentId);
      const found = docs.find(d => d.filename === "url-source-test.txt");
      expect(found.source_url).toBe("https://example.com/doc");
    });

    test("knowledge_documents supports research_job_id column", () => {
      const doc = manager.addKnowledgeDocument(agentId, {
        filename: "research-job-test.txt",
        file_type: "txt",
        research_job_id: "rj-12345",
      });
      const docs = manager.listKnowledgeDocuments(agentId);
      const found = docs.find(d => d.filename === "research-job-test.txt");
      expect(found.research_job_id).toBe("rj-12345");
    });

    test("kb_entry_versions table exists and stores version history", () => {
      // Get a doc id first
      const doc = manager.addKnowledgeDocument(agentId, {
        filename: "version-test.txt",
        file_type: "txt",
      });

      // Insert a version record
      db.run(
        `INSERT INTO kb_entry_versions (id, document_id, filename, content_hash, changed_by, change_type)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ["ver-1", doc.id, "version-test.txt", "abc123", "admin", "created"]
      );

      const results = db.exec(`SELECT * FROM kb_entry_versions WHERE document_id = '${doc.id}'`);
      expect(results.length).toBe(1);
      expect(results[0].values[0][2]).toBe("version-test.txt");
    });
  });

  // ─── Phase 3: Full CRUD + Lifecycle ─────────────────────────────────

  describe("Phase 3: KB CRUD lifecycle", () => {
    let agentId;

    beforeAll(() => {
      const agent = manager.createAgent({ name: "CRUD Test Agent", status: "active" });
      agentId = agent.id;
    });

    test("updateKnowledgeDocument updates filename and metadata", () => {
      const doc = manager.addKnowledgeDocument(agentId, {
        filename: "old-name.txt",
        file_type: "txt",
        file_size: 100,
      });

      const updated = manager.updateKnowledgeDocument(doc.id, {
        filename: "new-name.txt",
        priority: 90,
      });

      expect(updated).toBeTruthy();
      expect(updated.filename).toBe("new-name.txt");
      expect(updated.priority).toBe(90);
    });

    test("updateKnowledgeDocument returns null for nonexistent document", () => {
      const result = manager.updateKnowledgeDocument("nonexistent-id", { filename: "x" });
      expect(result).toBeNull();
    });

    test("softDeleteDocument marks document as deleted without removing it", () => {
      const doc = manager.addKnowledgeDocument(agentId, {
        filename: "soft-delete-me.txt",
        file_type: "txt",
      });

      const result = manager.softDeleteDocument(doc.id);
      expect(result).toBeTruthy();
      expect(result.is_deleted).toBe(1);
      expect(result.deleted_at).toBeTruthy();

      // Still in DB but excluded from active list
      const activeDocs = manager.listKnowledgeDocuments(agentId);
      expect(activeDocs.find(d => d.id === doc.id)).toBeUndefined();
    });

    test("restoreDocument un-deletes a soft-deleted document", () => {
      const doc = manager.addKnowledgeDocument(agentId, {
        filename: "restore-me.txt",
        file_type: "txt",
      });

      manager.softDeleteDocument(doc.id);
      const restored = manager.restoreDocument(doc.id);

      expect(restored).toBeTruthy();
      expect(restored.is_deleted).toBe(0);
      expect(restored.deleted_at).toBeNull();

      const activeDocs = manager.listKnowledgeDocuments(agentId);
      expect(activeDocs.find(d => d.id === doc.id)).toBeTruthy();
    });

    test("hardDeleteDocument permanently removes the document", () => {
      const doc = manager.addKnowledgeDocument(agentId, {
        filename: "hard-delete-me.txt",
        file_type: "txt",
      });

      manager.hardDeleteDocument(doc.id);

      // Gone from all lists including soft-deleted
      const allDocs = manager.listKnowledgeDocuments(agentId, { includeDeleted: true });
      expect(allDocs.find(d => d.id === doc.id)).toBeUndefined();
    });

    test("batchDeleteDocuments soft-deletes multiple documents", () => {
      const doc1 = manager.addKnowledgeDocument(agentId, { filename: "batch1.txt", file_type: "txt" });
      const doc2 = manager.addKnowledgeDocument(agentId, { filename: "batch2.txt", file_type: "txt" });

      const result = manager.batchDeleteDocuments([doc1.id, doc2.id]);
      expect(result.deleted).toBe(2);

      const activeDocs = manager.listKnowledgeDocuments(agentId);
      expect(activeDocs.find(d => d.id === doc1.id)).toBeUndefined();
      expect(activeDocs.find(d => d.id === doc2.id)).toBeUndefined();
    });

    test("listKnowledgeDocuments excludes soft-deleted by default", () => {
      const doc = manager.addKnowledgeDocument(agentId, { filename: "hidden.txt", file_type: "txt" });
      manager.softDeleteDocument(doc.id);

      const activeDocs = manager.listKnowledgeDocuments(agentId);
      expect(activeDocs.find(d => d.id === doc.id)).toBeUndefined();
    });

    test("listKnowledgeDocuments includes soft-deleted when requested", () => {
      const doc = manager.addKnowledgeDocument(agentId, { filename: "visible-deleted.txt", file_type: "txt" });
      manager.softDeleteDocument(doc.id);

      const allDocs = manager.listKnowledgeDocuments(agentId, { includeDeleted: true });
      expect(allDocs.find(d => d.id === doc.id)).toBeTruthy();
    });

    test("updateWebSource updates name and refresh interval", () => {
      const src = manager.addWebSource(agentId, {
        url: "https://example.com",
        name: "Old Name",
      });

      const updated = manager.updateWebSource(src.id, {
        name: "New Name",
        refresh_interval_hours: 48,
      });

      expect(updated).toBeTruthy();
      expect(updated.name).toBe("New Name");
      expect(updated.refresh_interval_hours).toBe(48);
    });

    test("updateWebSource returns null for nonexistent source", () => {
      const result = manager.updateWebSource("nonexistent-id", { name: "x" });
      expect(result).toBeNull();
    });

    test("getKnowledgeDocument returns a single document by ID", () => {
      const doc = manager.addKnowledgeDocument(agentId, {
        filename: "get-single.txt",
        file_type: "txt",
        priority: 75,
      });

      const found = manager.getKnowledgeDocument(doc.id);
      expect(found).toBeTruthy();
      expect(found.filename).toBe("get-single.txt");
      expect(found.priority).toBe(75);
    });

    test("getKnowledgeDocument returns null for nonexistent", () => {
      expect(manager.getKnowledgeDocument("nonexistent")).toBeNull();
    });
  });

  // ─── Phase 3B: KB Health / Stats ────────────────────────────────────

  describe("Phase 3B: KB health and stats", () => {
    let agentId;

    beforeAll(() => {
      const agent = manager.createAgent({ name: "Health Test Agent", status: "active" });
      agentId = agent.id;
      // Add some documents
      manager.addKnowledgeDocument(agentId, { filename: "doc1.txt", file_type: "txt", file_size: 1000, status: "indexed" });
      manager.addKnowledgeDocument(agentId, { filename: "doc2.txt", file_type: "txt", file_size: 2000, status: "indexed" });
      manager.addWebSource(agentId, { url: "https://example.com", name: "Test" });
    });

    test("getKBStats returns document count, source count, and total size", () => {
      const stats = manager.getKBStats(agentId);
      expect(stats.documentCount).toBeGreaterThanOrEqual(2);
      expect(stats.webSourceCount).toBeGreaterThanOrEqual(1);
      expect(stats.totalSizeBytes).toBeGreaterThanOrEqual(3000);
    });

    test("getKBStats returns zero counts for agent with no KB", () => {
      const empty = manager.createAgent({ name: "Empty Agent", status: "active" });
      const stats = manager.getKBStats(empty.id);
      expect(stats.documentCount).toBe(0);
      expect(stats.webSourceCount).toBe(0);
      expect(stats.totalSizeBytes).toBe(0);
    });
  });

  // ─── Phase 4: Research-to-KB pipeline ───────────────────────────────

  describe("Phase 4: Research-to-KB auto-population", () => {
    test("populateKBFromResearch adds high-confidence sources to agent KB", () => {
      const agent = manager.createAgent({ name: "Research KB Agent", status: "active" });

      const researchSources = [
        { url: "https://gov.example/policy.pdf", title: "Policy Doc", text: "Policy content about governance", composite: 0.85 },
        { url: "https://blog.example/post", title: "Blog Post", text: "Low quality blog content", composite: 0.3 },
        { url: "https://edu.example/research", title: "Research Paper", text: "Academic findings on governance", composite: 0.92 },
      ];

      const result = manager.populateKBFromResearch(agent.id, {
        jobId: "rj-populate-1",
        sources: researchSources,
        threshold: 0.65,
      });

      expect(result.added).toBe(2); // Only the two above threshold
      expect(result.skipped).toBe(1);

      const docs = manager.listKnowledgeDocuments(agent.id);
      expect(docs.length).toBe(2);
      expect(docs.every(d => d.added_by === "deep_research")).toBe(true);
      expect(docs.every(d => d.research_job_id === "rj-populate-1")).toBe(true);
    });

    test("populateKBFromResearch skips all sources below threshold", () => {
      const agent = manager.createAgent({ name: "Low Research Agent", status: "active" });

      const result = manager.populateKBFromResearch(agent.id, {
        jobId: "rj-low-1",
        sources: [
          { url: "https://x.com/a", title: "A", text: "content", composite: 0.2 },
          { url: "https://x.com/b", title: "B", text: "content", composite: 0.4 },
        ],
        threshold: 0.65,
      });

      expect(result.added).toBe(0);
      expect(result.skipped).toBe(2);
    });

    test("populateKBFromResearch uses default threshold of 0.65", () => {
      const agent = manager.createAgent({ name: "Default Threshold Agent", status: "active" });

      const result = manager.populateKBFromResearch(agent.id, {
        jobId: "rj-default-1",
        sources: [
          { url: "https://x.com/good", title: "Good", text: "quality content", composite: 0.7 },
        ],
      });

      expect(result.added).toBe(1);
    });
  });

  // ─── Phase 5: Auto-builder KB integration ───────────────────────────

  describe("Phase 5: KB provisioning on agent creation", () => {
    test("provisionKBFromWebSources adds discovered URLs to agent KB", () => {
      const agent = manager.createAgent({ name: "Provisioned Agent", status: "pending" });

      const webSources = [
        { url: "https://city.gov/hr", name: "HR Page" },
        { url: "https://city.gov/finance", name: "Finance Page" },
      ];

      const result = manager.provisionKBFromWebSources(agent.id, webSources);
      expect(result.sourcesAdded).toBe(2);

      const sources = manager.listWebSources(agent.id);
      expect(sources.length).toBe(2);
    });

    test("getKBCoverageAnalysis returns coverage score and gap summary", () => {
      const agent = manager.createAgent({
        name: "Coverage Agent",
        domain: "HR",
        capabilities: ["benefits", "hiring", "payroll"],
        status: "active",
      });

      // Add some docs covering "benefits" and "hiring"
      manager.addKnowledgeDocument(agent.id, {
        filename: "benefits-guide.txt",
        file_type: "txt",
        file_size: 5000,
      });
      manager.addKnowledgeDocument(agent.id, {
        filename: "hiring-process.txt",
        file_type: "txt",
        file_size: 3000,
      });

      const analysis = manager.getKBCoverageAnalysis(agent.id);
      expect(analysis).toBeTruthy();
      expect(typeof analysis.coverageScore).toBe("number");
      expect(analysis.coverageScore).toBeGreaterThanOrEqual(0);
      expect(analysis.coverageScore).toBeLessThanOrEqual(1);
      expect(typeof analysis.gapSummary).toBe("string");
      expect(analysis.documentCount).toBeGreaterThanOrEqual(2);
    });
  });
});
