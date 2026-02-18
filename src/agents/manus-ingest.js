/**
 * ManusIngestService — Ingests MANUS research outputs into agent knowledge bases.
 *
 * Handles single file ingest, batch ingest, domain auto-routing, and metadata
 * tagging. MANUS-sourced documents receive priority boost (80 vs default 50)
 * and are tagged with source_type "manus_research" for provenance tracking.
 */

const MANUS_DEFAULT_PRIORITY = 80;

class ManusIngestService {
  /**
   * @param {Object} deps
   * @param {Object} deps.agentManager - AgentManagerService instance
   * @param {Object} deps.rag - RAGPipeline instance
   * @param {Object} deps.documentParser - DocumentParser instance
   */
  constructor({ agentManager, rag, documentParser }) {
    this.agentManager = agentManager;
    this.rag = rag;
    this.parser = documentParser;
  }

  /**
   * Ingest a single file into an agent's knowledge base.
   * Parses content, indexes into RAG, creates KB document with MANUS tags.
   *
   * @param {string} agentId
   * @param {Object} file
   * @param {string} file.filename
   * @param {string} file.file_type
   * @param {string} file.content - Raw content (text or base64 for binary)
   * @param {string} [file.encoding] - "base64" for encoded content
   * @param {number} [file.priority] - Override default MANUS priority (80)
   * @param {string} [file.manus_job_id] - MANUS job identifier for tracking
   * @param {string[]} [file.tags] - Custom tags for categorization
   * @returns {Promise<{ ok: boolean, document?: Object, chunksIndexed?: number, error?: string }>}
   */
  async ingestFile(agentId, file) {
    // Validate required fields
    if (!file.filename) {
      return { ok: false, error: "filename is required" };
    }
    if (!file.content) {
      return { ok: false, error: "content is required" };
    }

    try {
      // Parse content through DocumentParser
      const parseResult = await this.parser.parse(file.content, file.file_type, {
        encoding: file.encoding || undefined,
      });

      const parsedText = parseResult.text || "";
      if (!parsedText) {
        return { ok: false, error: "No text could be extracted from content" };
      }

      const priority = file.priority || MANUS_DEFAULT_PRIORITY;

      // Build metadata — includes parsed content for restart re-indexing
      const metadata = {
        content: parsedText,
        source: "manus_research",
      };
      if (file.manus_job_id) metadata.manus_job_id = file.manus_job_id;
      if (file.tags) metadata.tags = file.tags;
      if (parseResult.metadata && Object.keys(parseResult.metadata).length) {
        metadata.parsed = parseResult.metadata;
      }

      // Create KB document
      const doc = this.agentManager.addKnowledgeDocument(agentId, {
        filename: file.filename,
        file_type: file.file_type || "txt",
        file_size: file.content.length,
        source_type: "manus_research",
        added_by: "manus",
        priority,
        metadata,
      });

      // Index into RAG pipeline
      let chunksIndexed = 0;
      if (this.rag) {
        const chunkCount = this.rag.indexDocument(agentId, doc.id, parsedText, {
          filename: file.filename,
          file_type: file.file_type,
          source: "manus_research",
        });
        chunksIndexed = typeof chunkCount === "number" ? chunkCount : 0;

        // Update chunk_count on document
        this.agentManager.updateKnowledgeDocument(doc.id, { chunk_count: chunksIndexed });
      }

      return {
        ok: true,
        document: { ...doc, source_type: "manus_research", added_by: "manus", priority },
        chunksIndexed,
      };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Ingest multiple files in batch.
   *
   * @param {string} agentId
   * @param {Object} batch
   * @param {Array} batch.files - Array of file objects (same format as ingestFile)
   * @param {number} [batch.priority] - Shared priority override for all files
   * @returns {Promise<{ total: number, succeeded: number, failed: number, documents: Array }>}
   */
  async ingestBatch(agentId, batch) {
    const files = batch.files || [];
    const results = { total: files.length, succeeded: 0, failed: 0, documents: [] };

    for (const file of files) {
      const fileWithPriority = batch.priority ? { ...file, priority: batch.priority } : file;
      const result = await this.ingestFile(agentId, fileWithPriority);
      results.documents.push(result);

      if (result.ok) {
        results.succeeded++;
      } else {
        results.failed++;
      }
    }

    return results;
  }

  /**
   * Auto-route a file to the best-matching agent based on domain keywords,
   * or use an explicit agent_id override.
   *
   * @param {Object} file - File object with optional agent_id
   * @returns {Promise<{ ok: boolean, routed_to_agent_id?: string, document?: Object, error?: string }>}
   */
  async routeAndIngest(file) {
    // Explicit agent_id override
    if (file.agent_id) {
      const result = await this.ingestFile(file.agent_id, file);
      return { ...result, routed_to_agent_id: file.agent_id };
    }

    // Auto-route by matching content to agent domains
    const agents = this.agentManager.listAgents().filter(a => a.status === "active" && a.domain);
    const contentLower = ((file.content || "") + " " + (file.filename || "")).toLowerCase();

    let bestMatch = null;
    let bestScore = 0;

    for (const agent of agents) {
      const domain = (agent.domain || "").toLowerCase();
      const domainWords = domain.split(/[-_\s]+/).filter(w => w.length > 2);
      const nameWords = (agent.name || "").toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const allKeywords = [...domainWords, ...nameWords];

      let score = 0;
      for (const keyword of allKeywords) {
        if (contentLower.includes(keyword)) score++;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = agent;
      }
    }

    if (!bestMatch || bestScore === 0) {
      return { ok: false, error: "No matching agent found for content" };
    }

    const result = await this.ingestFile(bestMatch.id, file);
    return { ...result, routed_to_agent_id: bestMatch.id };
  }

  /**
   * Get statistics about MANUS-sourced documents for an agent.
   *
   * @param {string} agentId
   * @returns {{ manusDocuments: number, totalChunks: number }}
   */
  getIngestStats(agentId) {
    const docs = this.agentManager.listKnowledgeDocuments(agentId);
    const manusDocs = docs.filter(d => d.source_type === "manus_research" || d.added_by === "manus");

    const totalChunks = manusDocs.reduce((sum, d) => sum + (d.chunk_count || 0), 0);

    return {
      manusDocuments: manusDocs.length,
      totalChunks,
    };
  }
}

module.exports = { ManusIngestService };
