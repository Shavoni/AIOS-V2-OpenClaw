const initSqlJs = require("sql.js");

describe("VectorStore", () => {
  let db, store;
  const { VectorStore } = require("../../src/rag/vector-store");

  // Helper: create a Float32Array embedding of given dimension
  function makeEmbedding(values) {
    return new Float32Array(values);
  }

  beforeAll(async () => {
    const SQL = await initSqlJs();
    db = new SQL.Database();

    // Create the embeddings table (mirrors schema.js addition)
    db.run(`CREATE TABLE IF NOT EXISTS embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      chunk_index INTEGER DEFAULT 0,
      embedding BLOB NOT NULL,
      text_preview TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_embeddings_agent ON embeddings(agent_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_embeddings_document ON embeddings(document_id)`);
  });

  beforeEach(() => {
    // Clear data between tests
    db.run("DELETE FROM embeddings");
    store = new VectorStore(db, () => {});
  });

  afterAll(() => {
    if (db) db.close();
  });

  // ─── Test 1: store() persists an embedding to the DB ─────────────
  test("store() persists an embedding to the DB", () => {
    const embedding = makeEmbedding([1.0, 0.0, 0.0]);
    store.store("agent-1", "doc-1", 0, embedding, "Hello world");

    const result = db.exec("SELECT agent_id, document_id, chunk_index, text_preview FROM embeddings");
    expect(result.length).toBe(1);
    expect(result[0].values.length).toBe(1);

    const [agentId, documentId, chunkIndex, textPreview] = result[0].values[0];
    expect(agentId).toBe("agent-1");
    expect(documentId).toBe("doc-1");
    expect(chunkIndex).toBe(0);
    expect(textPreview).toBe("Hello world");
  });

  test("store() persists the embedding BLOB that can be read back as Float32Array", () => {
    const embedding = makeEmbedding([0.5, 0.25, 0.75]);
    store.store("agent-1", "doc-1", 0, embedding, "test");

    const result = db.exec("SELECT embedding FROM embeddings");
    const blobData = result[0].values[0][0];
    // sql.js returns Uint8Array for BLOBs
    const recovered = new Float32Array(
      blobData.buffer.slice(blobData.byteOffset, blobData.byteOffset + blobData.byteLength)
    );
    expect(recovered.length).toBe(3);
    expect(recovered[0]).toBeCloseTo(0.5);
    expect(recovered[1]).toBeCloseTo(0.25);
    expect(recovered[2]).toBeCloseTo(0.75);
  });

  // ─── Test 2: search() returns ranked results by cosine similarity ──
  test("search() returns ranked results by cosine similarity", () => {
    // Query vector: [1, 0, 0]
    // Embedding 1: [1, 0, 0] - identical to query, score = 1.0
    // Embedding 2: [0.7, 0.7, 0] - partial match
    // Embedding 3: [0, 0, 1] - orthogonal, score = 0.0
    store.store("agent-1", "doc-1", 0, makeEmbedding([1, 0, 0]), "exact match");
    store.store("agent-1", "doc-1", 1, makeEmbedding([0.7, 0.7, 0]), "partial match");
    store.store("agent-1", "doc-1", 2, makeEmbedding([0, 0, 1]), "orthogonal");

    const query = makeEmbedding([1, 0, 0]);
    const results = store.search("agent-1", query, 5);

    expect(results.length).toBe(3);
    // First result should be exact match with score ~1.0
    expect(results[0].textPreview).toBe("exact match");
    expect(results[0].score).toBeCloseTo(1.0, 4);
    // Second result should be partial match
    expect(results[1].textPreview).toBe("partial match");
    expect(results[1].score).toBeGreaterThan(0);
    expect(results[1].score).toBeLessThan(1.0);
    // Third result should be orthogonal with score ~0.0
    expect(results[2].textPreview).toBe("orthogonal");
    expect(results[2].score).toBeCloseTo(0.0, 4);
  });

  // ─── Test 3: deleteByDocument() removes all embeddings for a document ──
  test("deleteByDocument() removes all embeddings for a document", () => {
    store.store("agent-1", "doc-1", 0, makeEmbedding([1, 0, 0]), "chunk 0");
    store.store("agent-1", "doc-1", 1, makeEmbedding([0, 1, 0]), "chunk 1");
    store.store("agent-1", "doc-2", 0, makeEmbedding([0, 0, 1]), "other doc");

    store.deleteByDocument("doc-1");

    const result = db.exec("SELECT document_id FROM embeddings");
    expect(result.length).toBe(1);
    expect(result[0].values.length).toBe(1);
    expect(result[0].values[0][0]).toBe("doc-2");
  });

  // ─── Test 4: deleteByAgent() removes all embeddings for an agent ──
  test("deleteByAgent() removes all embeddings for an agent", () => {
    store.store("agent-1", "doc-1", 0, makeEmbedding([1, 0, 0]), "agent 1 data");
    store.store("agent-1", "doc-2", 0, makeEmbedding([0, 1, 0]), "agent 1 data 2");
    store.store("agent-2", "doc-3", 0, makeEmbedding([0, 0, 1]), "agent 2 data");

    store.deleteByAgent("agent-1");

    const result = db.exec("SELECT agent_id FROM embeddings");
    expect(result.length).toBe(1);
    expect(result[0].values.length).toBe(1);
    expect(result[0].values[0][0]).toBe("agent-2");
  });

  // ─── Test 5: Cosine similarity - identical vectors = 1.0, orthogonal = 0.0 ──
  test("cosine similarity: identical vectors return 1.0", () => {
    const a = makeEmbedding([1, 2, 3]);
    const b = makeEmbedding([1, 2, 3]);
    expect(VectorStore.cosineSimilarity(a, b)).toBeCloseTo(1.0, 6);
  });

  test("cosine similarity: orthogonal vectors return 0.0", () => {
    const a = makeEmbedding([1, 0, 0]);
    const b = makeEmbedding([0, 1, 0]);
    expect(VectorStore.cosineSimilarity(a, b)).toBeCloseTo(0.0, 6);
  });

  test("cosine similarity: opposite vectors return -1.0", () => {
    const a = makeEmbedding([1, 0, 0]);
    const b = makeEmbedding([-1, 0, 0]);
    expect(VectorStore.cosineSimilarity(a, b)).toBeCloseTo(-1.0, 6);
  });

  // ─── Test 6: cosineSimilarity is a static method ─────────────────
  test("cosineSimilarity is a static method on VectorStore", () => {
    expect(typeof VectorStore.cosineSimilarity).toBe("function");
    // Should work without an instance
    const result = VectorStore.cosineSimilarity(
      makeEmbedding([3, 4]),
      makeEmbedding([4, 3])
    );
    expect(typeof result).toBe("number");
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(1.0);
  });

  test("cosineSimilarity handles zero vectors gracefully", () => {
    const zero = makeEmbedding([0, 0, 0]);
    const nonzero = makeEmbedding([1, 2, 3]);
    expect(VectorStore.cosineSimilarity(zero, nonzero)).toBe(0);
    expect(VectorStore.cosineSimilarity(zero, zero)).toBe(0);
  });

  // ─── Test 7: search returns descending score order, limited to topK ──
  test("search returns results in descending score order limited to topK", () => {
    // Store 5 embeddings with varying similarity to query [1, 0, 0]
    store.store("agent-1", "doc-1", 0, makeEmbedding([1, 0, 0]), "best");
    store.store("agent-1", "doc-1", 1, makeEmbedding([0.9, 0.1, 0]), "second");
    store.store("agent-1", "doc-1", 2, makeEmbedding([0.5, 0.5, 0]), "third");
    store.store("agent-1", "doc-1", 3, makeEmbedding([0.1, 0.9, 0]), "fourth");
    store.store("agent-1", "doc-1", 4, makeEmbedding([0, 1, 0]), "fifth");

    const query = makeEmbedding([1, 0, 0]);
    const results = store.search("agent-1", query, 3);

    // Should only return topK=3 results
    expect(results.length).toBe(3);

    // Verify descending score order
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
    }

    // Best result should be the exact match
    expect(results[0].textPreview).toBe("best");
  });

  test("search results include documentId, chunkIndex, textPreview, and score", () => {
    store.store("agent-1", "doc-42", 7, makeEmbedding([1, 0, 0]), "sample text");

    const query = makeEmbedding([1, 0, 0]);
    const results = store.search("agent-1", query, 5);

    expect(results.length).toBe(1);
    expect(results[0]).toHaveProperty("documentId", "doc-42");
    expect(results[0]).toHaveProperty("chunkIndex", 7);
    expect(results[0]).toHaveProperty("textPreview", "sample text");
    expect(results[0]).toHaveProperty("score");
    expect(results[0].score).toBeCloseTo(1.0);
  });

  // ─── Test 8: Empty store returns empty array for search ──────────
  test("empty store returns empty array for search", () => {
    const query = makeEmbedding([1, 0, 0]);
    const results = store.search("agent-1", query, 5);
    expect(results).toEqual([]);
  });

  test("search for non-existent agent returns empty array", () => {
    store.store("agent-1", "doc-1", 0, makeEmbedding([1, 0, 0]), "data");

    const query = makeEmbedding([1, 0, 0]);
    const results = store.search("agent-nonexistent", query, 5);
    expect(results).toEqual([]);
  });

  // ─── Additional edge cases ──────────────────────────────────────
  test("search only returns embeddings for the specified agent", () => {
    store.store("agent-1", "doc-1", 0, makeEmbedding([1, 0, 0]), "agent 1");
    store.store("agent-2", "doc-2", 0, makeEmbedding([1, 0, 0]), "agent 2");

    const query = makeEmbedding([1, 0, 0]);
    const results = store.search("agent-1", query, 5);

    expect(results.length).toBe(1);
    expect(results[0].textPreview).toBe("agent 1");
  });

  test("store() calls markDirty callback", () => {
    const markDirty = jest.fn();
    const dirtyStore = new VectorStore(db, markDirty);
    dirtyStore.store("agent-1", "doc-1", 0, makeEmbedding([1, 0, 0]), "test");
    expect(markDirty).toHaveBeenCalledTimes(1);
  });

  test("deleteByDocument() calls markDirty callback", () => {
    const markDirty = jest.fn();
    const dirtyStore = new VectorStore(db, markDirty);
    dirtyStore.deleteByDocument("doc-1");
    expect(markDirty).toHaveBeenCalledTimes(1);
  });

  test("deleteByAgent() calls markDirty callback", () => {
    const markDirty = jest.fn();
    const dirtyStore = new VectorStore(db, markDirty);
    dirtyStore.deleteByAgent("agent-1");
    expect(markDirty).toHaveBeenCalledTimes(1);
  });

  test("store multiple chunks for the same document and retrieve them", () => {
    store.store("agent-1", "doc-1", 0, makeEmbedding([1, 0, 0]), "chunk 0");
    store.store("agent-1", "doc-1", 1, makeEmbedding([0, 1, 0]), "chunk 1");
    store.store("agent-1", "doc-1", 2, makeEmbedding([0, 0, 1]), "chunk 2");

    const result = db.exec("SELECT COUNT(*) FROM embeddings WHERE document_id = 'doc-1'");
    expect(result[0].values[0][0]).toBe(3);
  });
});
