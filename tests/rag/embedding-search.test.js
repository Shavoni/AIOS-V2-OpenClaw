/**
 * TDD RED → GREEN: Enhanced RAG Pipeline with embedding support
 */

const initSqlJs = require('sql.js');
const { initSchema } = require('../../src/db/schema');
const { RAGPipeline } = require('../../src/rag');
const { VectorStore } = require('../../src/rag/vector-store');

describe('RAGPipeline - Embedding-Enhanced Search', () => {
  let db, markDirty;

  beforeEach(async () => {
    const SQL = await initSqlJs();
    db = new SQL.Database();
    db.run("PRAGMA foreign_keys = ON");
    initSchema(db);
    markDirty = jest.fn();
  });

  afterEach(() => { if (db) db.close(); });

  it('with embedder: indexDocument generates and stores embeddings per chunk', async () => {
    const mockEmbedder = {
      embed: jest.fn().mockResolvedValue(new Float32Array([0.1, 0.2, 0.3])),
      embedBatch: jest.fn().mockResolvedValue([
        new Float32Array([0.1, 0.2, 0.3]),
        new Float32Array([0.4, 0.5, 0.6]),
      ]),
    };
    const vectorStore = new VectorStore(db, markDirty);

    const rag = new RAGPipeline(null, null, { embedder: mockEmbedder, vectorStore });
    const content = 'First paragraph about deployment.\n\nSecond paragraph about testing.';
    await rag.indexDocument('agent1', 'doc1', content, { filename: 'readme.md' });

    // Verify embedder was called
    expect(mockEmbedder.embedBatch).toHaveBeenCalled();

    // Verify embeddings stored in DB
    const result = db.exec("SELECT COUNT(*) FROM embeddings WHERE agent_id = 'agent1'");
    expect(result[0].values[0][0]).toBeGreaterThan(0);
  });

  it('with embedder: retrieveContext uses vector search', async () => {
    const mockEmbedder = {
      embed: jest.fn().mockResolvedValue(new Float32Array([0.9, 0.1, 0.0])),
      embedBatch: jest.fn(),
    };
    const vectorStore = new VectorStore(db, markDirty);

    // Pre-store some embeddings
    vectorStore.store('agent1', 'doc1', 0, new Float32Array([0.9, 0.1, 0.0]), 'This chunk about deployment');
    vectorStore.store('agent1', 'doc1', 1, new Float32Array([0.1, 0.9, 0.0]), 'This chunk about testing');
    vectorStore.store('agent1', 'doc1', 2, new Float32Array([0.0, 0.1, 0.9]), 'This chunk about cooking');

    const rag = new RAGPipeline(null, null, { embedder: mockEmbedder, vectorStore });
    const context = await rag.retrieveContext('agent1', 'tell me about deployment');

    expect(mockEmbedder.embed).toHaveBeenCalledWith('tell me about deployment');
    expect(context).toContain('deployment');
    // Should NOT prominently feature the unrelated "cooking" chunk
  });

  it('without embedder: falls back to TF-IDF (existing behavior)', async () => {
    const rag = new RAGPipeline(null, null);

    // Index using keyword search
    rag.indexDocument('agent1', 'doc1', 'Deployment is the process of deploying code to production servers.');
    const context = rag.retrieveContext('agent1', 'deployment');
    // Should work synchronously and still find relevant content
    expect(context).toContain('deploy');
  });

  it('without embedder: indexDocument works synchronously', () => {
    const rag = new RAGPipeline(null, null);
    const result = rag.indexDocument('agent1', 'doc1', 'Some document content here');
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThan(0);
  });

  it('retrieveContext returns empty string when no results found', async () => {
    const mockEmbedder = {
      embed: jest.fn().mockResolvedValue(new Float32Array([0.5, 0.5])),
    };
    const vectorStore = new VectorStore(db, markDirty);

    const rag = new RAGPipeline(null, null, { embedder: mockEmbedder, vectorStore });
    const context = await rag.retrieveContext('nonexistent', 'query');
    expect(context).toBe('');
  });

  it('indexDocument returns chunk count even with embedder', async () => {
    const mockEmbedder = {
      embed: jest.fn().mockResolvedValue(new Float32Array([0.1, 0.2])),
      embedBatch: jest.fn().mockResolvedValue([new Float32Array([0.1, 0.2])]),
    };
    const vectorStore = new VectorStore(db, markDirty);

    const rag = new RAGPipeline(null, null, { embedder: mockEmbedder, vectorStore });
    const count = await rag.indexDocument('agent1', 'doc1', 'A short document.');
    expect(typeof count).toBe('number');
    expect(count).toBeGreaterThan(0);
  });

  it('with embedder: graceful fallback when embed returns null', async () => {
    const mockEmbedder = {
      embed: jest.fn().mockResolvedValue(null),
      embedBatch: jest.fn().mockResolvedValue(null),
    };
    const vectorStore = new VectorStore(db, markDirty);

    const rag = new RAGPipeline(null, null, { embedder: mockEmbedder, vectorStore });

    // indexDocument should not throw when embedBatch returns null
    const count = await rag.indexDocument('agent1', 'doc1', 'Some content.');
    expect(count).toBeGreaterThan(0);

    // retrieveContext should return empty when embed returns null
    const context = await rag.retrieveContext('agent1', 'query');
    expect(context).toBe('');
  });
});
