/**
 * Vector Store - SQLite-backed embedding storage with cosine similarity search.
 * Stores embeddings as BLOBs (Float32Array → Buffer) and performs
 * brute-force cosine similarity search at query time.
 */

class VectorStore {
  /**
   * @param {object} db - sql.js Database instance
   * @param {function} markDirty - Callback to signal DB has been modified
   */
  constructor(db, markDirty) {
    this.db = db;
    this.markDirty = markDirty || (() => {});
  }

  /**
   * Store an embedding for a document chunk.
   * @param {string} agentId - Owner agent ID
   * @param {string} documentId - Source document ID
   * @param {number} chunkIndex - Chunk position within the document
   * @param {Float32Array} embedding - The embedding vector
   * @param {string} textPreview - Short text preview of the chunk
   */
  store(agentId, documentId, chunkIndex, embedding, textPreview = "") {
    const buffer = Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength);
    this.db.run(
      "INSERT INTO embeddings (agent_id, document_id, chunk_index, embedding, text_preview) VALUES (?, ?, ?, ?, ?)",
      [agentId, documentId, chunkIndex, buffer, textPreview]
    );
    this.markDirty();
  }

  /**
   * Search for the most similar embeddings to a query vector within an agent's scope.
   * @param {string} agentId - Agent to search within
   * @param {Float32Array} queryEmbedding - The query vector
   * @param {number} topK - Maximum number of results to return
   * @returns {Array<{documentId: string, chunkIndex: number, textPreview: string, score: number}>}
   */
  search(agentId, queryEmbedding, topK = 5) {
    const stmt = this.db.prepare(
      "SELECT document_id, chunk_index, embedding, text_preview FROM embeddings WHERE agent_id = ?"
    );
    stmt.bind([agentId]);

    const results = [];

    while (stmt.step()) {
      const row = stmt.getAsObject();
      // sql.js returns Uint8Array for BLOBs - convert back to Float32Array
      const blobData = row.embedding;
      const storedEmbedding = new Float32Array(
        blobData.buffer.slice(blobData.byteOffset, blobData.byteOffset + blobData.byteLength)
      );

      const score = VectorStore.cosineSimilarity(queryEmbedding, storedEmbedding);

      results.push({
        documentId: row.document_id,
        chunkIndex: row.chunk_index,
        textPreview: row.text_preview,
        score,
      });
    }

    stmt.free();

    // Sort by score descending and limit to topK
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /**
   * Delete all embeddings for a specific document.
   * @param {string} documentId - Document to remove embeddings for
   */
  deleteByDocument(documentId) {
    this.db.run("DELETE FROM embeddings WHERE document_id = ?", [documentId]);
    this.markDirty();
  }

  /**
   * Delete all embeddings for a specific agent.
   * @param {string} agentId - Agent to remove embeddings for
   */
  deleteByAgent(agentId) {
    this.db.run("DELETE FROM embeddings WHERE agent_id = ?", [agentId]);
    this.markDirty();
  }

  /**
   * Compute cosine similarity between two vectors.
   * @param {Float32Array} a - First vector
   * @param {Float32Array} b - Second vector
   * @returns {number} Cosine similarity in range [-1, 1], or 0 if either vector is zero
   */
  static cosineSimilarity(a, b) {
    let dot = 0;
    let magA = 0;
    let magB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
  }
}

module.exports = { VectorStore };
