/**
 * RAG Pipeline - Combines chunking, indexing, and retrieval.
 * Supports dual-path: embedding-based vector search when an embedder is configured,
 * with TF-IDF keyword fallback when not.
 */

const { DocumentChunker } = require("./chunker");
const { ChunkSearch } = require("./search");

class RAGPipeline {
  /**
   * @param {Object} agentManagerService
   * @param {Object} canonService
   * @param {Object} [options]
   * @param {Object} [options.embedder] - Embedding provider (OpenAIEmbedder/OllamaEmbedder)
   * @param {Object} [options.vectorStore] - VectorStore instance for persisting embeddings
   */
  constructor(agentManagerService, canonService, options = {}) {
    this.agents = agentManagerService;
    this.canon = canonService;
    this.chunker = new DocumentChunker();
    this.search = new ChunkSearch();
    this.embedder = options.embedder || null;
    this.vectorStore = options.vectorStore || null;
  }

  /**
   * Index a document for a specific agent.
   * When an embedder is available, generates and stores vector embeddings.
   * Always indexes in keyword search as well (fallback path).
   * @param {string} agentId
   * @param {string} documentId
   * @param {string} content - Document text
   * @param {Object} metadata - filename, file_type, etc.
   * @returns {number|Promise<number>} Number of chunks created
   */
  indexDocument(agentId, documentId, content, metadata = {}) {
    const isMarkdown = (metadata.file_type || "").includes("md") ||
                       (metadata.filename || "").endsWith(".md");

    const chunks = isMarkdown
      ? this.chunker.chunkMarkdown(content, { documentId, ...metadata })
      : this.chunker.chunk(content, { documentId, ...metadata });

    // Always index in keyword search
    this.search.indexChunks(agentId, documentId, chunks);

    // If embedder + vector store available, also generate embeddings
    if (this.embedder && this.vectorStore) {
      return this._indexEmbeddings(agentId, documentId, chunks);
    }

    return chunks.length;
  }

  /**
   * Generate and store embeddings for chunks.
   * @private
   */
  async _indexEmbeddings(agentId, documentId, chunks) {
    const texts = chunks.map(c => c.text);
    const embeddings = await this.embedder.embedBatch(texts);

    if (embeddings) {
      for (let i = 0; i < chunks.length; i++) {
        if (embeddings[i]) {
          this.vectorStore.store(
            agentId,
            documentId,
            chunks[i].index,
            embeddings[i],
            chunks[i].text.slice(0, 200)
          );
        }
      }
    }

    return chunks.length;
  }

  /**
   * Remove a document from the index.
   */
  removeDocument(agentId, documentId) {
    this.search.removeDocument(agentId, documentId);
    if (this.vectorStore) {
      this.vectorStore.deleteByDocument(documentId);
    }
  }

  /**
   * Index all shared canon documents (available to all agents).
   * @returns {number} Total chunks indexed
   */
  indexCanon() {
    if (!this.canon) return 0;
    const docs = this.canon.listDocuments();
    let total = 0;
    for (const doc of docs) {
      const chunks = this.indexDocument("__canon__", doc.id, doc.content || "", {
        filename: doc.filename,
        file_type: doc.file_type,
        source: "canon",
      });
      // indexDocument may return a promise if embedder is present; for canon indexing we keep it sync
      if (typeof chunks === 'number') total += chunks;
    }
    return total;
  }

  /**
   * Retrieve relevant context for a query.
   * Uses vector search when embedder is available, falls back to TF-IDF keyword search.
   * @param {string} agentId
   * @param {string} query
   * @param {number} maxChunks
   * @param {number} maxTokens
   * @returns {string|Promise<string>} Combined context text
   */
  retrieveContext(agentId, query, maxChunks = 5, maxTokens = 2000) {
    if (this.embedder && this.vectorStore) {
      return this._vectorRetrieve(agentId, query, maxChunks, maxTokens);
    }
    return this._keywordRetrieve(agentId, query, maxChunks, maxTokens);
  }

  /**
   * Vector-based retrieval using embeddings.
   * @private
   */
  async _vectorRetrieve(agentId, query, maxChunks, maxTokens) {
    const queryEmbedding = await this.embedder.embed(query);
    if (!queryEmbedding) return '';

    const agentResults = this.vectorStore.search(agentId, queryEmbedding, maxChunks);
    const canonResults = this.vectorStore.search('__canon__', queryEmbedding, 3);

    const allResults = [...agentResults, ...canonResults];
    const seen = new Set();
    const unique = [];

    for (const result of allResults) {
      const key = result.textPreview.slice(0, 100);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(result);
      }
    }

    // Sort by score descending
    unique.sort((a, b) => b.score - a.score);

    let totalTokens = 0;
    const contextParts = [];

    for (const result of unique.slice(0, maxChunks)) {
      const text = result.textPreview;
      const estimatedTokens = Math.ceil(text.length / 4);
      if (totalTokens + estimatedTokens > maxTokens) break;

      contextParts.push(`[Source: document]\n${text}`);
      totalTokens += estimatedTokens;
    }

    if (contextParts.length === 0) return '';
    return '--- Relevant Knowledge ---\n\n' + contextParts.join('\n\n---\n\n');
  }

  /**
   * TF-IDF keyword-based retrieval (original behavior).
   * @private
   */
  _keywordRetrieve(agentId, query, maxChunks, maxTokens) {
    const agentResults = this.search.search(agentId, query, maxChunks);
    const canonResults = this.search.search("__canon__", query, 3);

    const allResults = [...agentResults, ...canonResults];
    const seen = new Set();
    const unique = [];

    for (const result of allResults) {
      const key = result.text.slice(0, 100);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(result);
      }
    }

    let totalTokens = 0;
    const contextParts = [];

    for (const result of unique.slice(0, maxChunks)) {
      const estimatedTokens = Math.ceil(result.text.length / 4);
      if (totalTokens + estimatedTokens > maxTokens) break;

      const source = result.metadata?.filename || "document";
      contextParts.push(`[Source: ${source}]\n${result.text}`);
      totalTokens += estimatedTokens;
    }

    if (contextParts.length === 0) return "";
    return "--- Relevant Knowledge ---\n\n" + contextParts.join("\n\n---\n\n");
  }

  /**
   * Get index stats.
   */
  getStats() {
    return {
      canonChunks: this.search.getChunkCount("__canon__"),
      hasEmbedder: !!this.embedder,
    };
  }
}

module.exports = { RAGPipeline, DocumentChunker, ChunkSearch };
