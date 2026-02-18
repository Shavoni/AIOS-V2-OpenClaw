/**
 * Keyword-based search over document chunks.
 * Uses TF-IDF-like scoring without requiring external vector DB.
 */

class ChunkSearch {
  constructor() {
    // In-memory index: agentId → chunks[]
    this._index = new Map();
  }

  /**
   * Index chunks for a specific agent.
   * @param {string} agentId
   * @param {string} documentId
   * @param {Array} chunks - From DocumentChunker
   */
  indexChunks(agentId, documentId, chunks) {
    if (!this._index.has(agentId)) {
      this._index.set(agentId, []);
    }

    // Remove existing chunks for this document
    const existing = this._index.get(agentId);
    const filtered = existing.filter(c => c.documentId !== documentId);

    // Add new chunks with precomputed term frequencies
    for (const chunk of chunks) {
      filtered.push({
        documentId,
        text: chunk.text,
        index: chunk.index,
        metadata: chunk.metadata,
        terms: this._tokenize(chunk.text),
      });
    }

    this._index.set(agentId, filtered);
  }

  /**
   * Remove all chunks for a document.
   * @param {string} agentId
   * @param {string} documentId
   */
  removeDocument(agentId, documentId) {
    if (!this._index.has(agentId)) return;
    const chunks = this._index.get(agentId);
    this._index.set(agentId, chunks.filter(c => c.documentId !== documentId));
  }

  /**
   * Search chunks for a query, ranked by relevance.
   * @param {string} agentId
   * @param {string} query
   * @param {number} topK - Number of results to return
   * @returns {Array<{text: string, score: number, metadata: Object}>}
   */
  search(agentId, query, topK = 5) {
    const chunks = this._index.get(agentId);
    if (!chunks || chunks.length === 0) return [];

    const queryTerms = this._tokenize(query);
    if (queryTerms.size === 0) return [];

    // Precompute document frequencies for query terms (O(chunks) instead of O(terms * chunks))
    const docFreq = new Map();
    for (const chunk of chunks) {
      for (const term of queryTerms.keys()) {
        if (chunk.terms.has(term)) {
          docFreq.set(term, (docFreq.get(term) || 0) + 1);
        }
      }
    }

    const lowerQuery = query.toLowerCase();
    const totalChunks = chunks.length;

    // Score each chunk
    const scored = chunks.map(chunk => {
      let score = 0;
      let matchedTerms = 0;

      for (const [term, queryFreq] of queryTerms) {
        const chunkFreq = chunk.terms.get(term) || 0;
        if (chunkFreq > 0) {
          const tf = Math.log(1 + chunkFreq);
          const idf = Math.log(1 + totalChunks / (1 + (docFreq.get(term) || 0)));
          score += tf * idf * queryFreq;
          matchedTerms++;
        }
      }

      // Boost score if multiple query terms match (phrase-like matching)
      if (matchedTerms > 1) {
        score *= 1 + (matchedTerms / queryTerms.size) * 0.5;
      }

      // Boost exact substring matches
      if (chunk.text.toLowerCase().includes(lowerQuery)) {
        score *= 2;
      }

      return { text: chunk.text, score, metadata: chunk.metadata, documentId: chunk.documentId };
    });

    // Sort by score descending and return top K
    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Get total indexed chunks for an agent.
   */
  getChunkCount(agentId) {
    return (this._index.get(agentId) || []).length;
  }

  /**
   * Clear all indexed data.
   */
  clear() {
    this._index.clear();
  }

  _tokenize(text) {
    const terms = new Map();
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 2); // Skip very short words

    for (const word of words) {
      terms.set(word, (terms.get(word) || 0) + 1);
    }
    return terms;
  }

}

module.exports = { ChunkSearch };
