/**
 * ManusSessionIngest — Directory-to-agent pipeline.
 *
 * Scans a MANUS folder structure, validates manifest (description.md + instructions.md),
 * creates agents from folder contents, populates KBs from knowledge_base/*.md files
 * with priority classification (signal-stacking) and RAG indexing.
 *
 * Expected directory structure:
 *   baseDir/
 *     1. GPT_01_Name/
 *       GPT_01_Name/
 *         description.md
 *         instructions.md
 *         knowledge_base/
 *           HAAIS_GOVERNANCE_*.md
 *           01_topic.md
 *           02_topic.md
 */

const fs = require("fs");
const path = require("path");
const { ManusPriorityClassifier } = require("./manus-priority-classifier");

// Match numbered GPT folders: "1. GPT_01_Name" or "8. GPT_08_Public_Safety"
const GPT_FOLDER_PATTERN = /^\d+\.\s*GPT_\d+/;

class ManusSessionIngest {
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
    this.classifier = new ManusPriorityClassifier();
  }

  /**
   * Parse the manifest of a MANUS session directory.
   * Scans for numbered GPT folders, validates each has description.md + instructions.md,
   * counts KB files per folder, returns summary stats.
   *
   * @param {string} baseDir - Root directory of the MANUS session output
   * @returns {Promise<Object>} Manifest with folders array and summary stats
   */
  async parseManifest(baseDir) {
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    const folders = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (!GPT_FOLDER_PATTERN.test(entry.name)) continue;

      const folderPath = path.join(baseDir, entry.name);
      const folderInfo = this._analyzeGPTFolder(folderPath, entry.name);
      folders.push(folderInfo);
    }

    const validFolders = folders.filter(f => f.isValid).length;
    const invalidFolders = folders.filter(f => !f.isValid).length;
    const totalKBFiles = folders.reduce((sum, f) => sum + f.kbFileCount, 0);

    return {
      folders,
      totalFolders: folders.length,
      validFolders,
      invalidFolders,
      totalKBFiles,
    };
  }

  /**
   * Analyze a single GPT folder for validity and KB file count.
   * @private
   */
  _analyzeGPTFolder(folderPath, folderName) {
    // Extract agent name from folder name (e.g. "1. GPT_01_Urban_AI_Director" → "GPT_01_Urban_AI_Director")
    const agentName = folderName.replace(/^\d+\.\s*/, "");

    // Look for inner folder (MANUS nests: GPT_01_Name/GPT_01_Name/)
    const innerPath = path.join(folderPath, agentName);
    const workingDir = fs.existsSync(innerPath) ? innerPath : folderPath;

    const descPath = path.join(workingDir, "description.md");
    const instrPath = path.join(workingDir, "instructions.md");
    const kbDir = path.join(workingDir, "knowledge_base");

    const hasDescription = fs.existsSync(descPath);
    const hasInstructions = fs.existsSync(instrPath);

    const validationErrors = [];
    if (!hasDescription) validationErrors.push("Missing description.md");
    if (!hasInstructions) validationErrors.push("Missing instructions.md");

    let kbFileCount = 0;
    let kbFiles = [];
    if (fs.existsSync(kbDir)) {
      kbFiles = fs.readdirSync(kbDir).filter(f => f.endsWith(".md"));
      kbFileCount = kbFiles.length;
    }

    return {
      folderName,
      agentName,
      folderPath,
      workingDir,
      isValid: hasDescription && hasInstructions,
      validationErrors,
      kbFileCount,
      kbFiles,
    };
  }

  /**
   * Ingest an entire MANUS session directory.
   * Creates agents from valid folders, populates KBs with priority classification + RAG indexing.
   * Idempotent — skips agents that already exist (matched by name).
   *
   * @param {string} baseDir - Root directory of the MANUS session output
   * @returns {Promise<Object>} Ingest results with per-agent details
   */
  async ingestSession(baseDir) {
    const manifest = await this.parseManifest(baseDir);
    const results = {
      agentsCreated: 0,
      agentsFailed: 0,
      foldersSkipped: 0,
      totalKBEntriesCreated: 0,
      agents: [],
    };

    for (const folder of manifest.folders) {
      if (!folder.isValid) {
        results.foldersSkipped++;
        continue;
      }

      try {
        const agentResult = await this._ingestFolder(folder);
        results.agents.push(agentResult);
        results.agentsCreated++;
        results.totalKBEntriesCreated += agentResult.kbEntries;
      } catch (err) {
        results.agentsFailed++;
      }
    }

    return results;
  }

  /**
   * Ingest a single valid GPT folder — create agent + populate KB.
   * @private
   */
  async _ingestFolder(folder) {
    const descContent = fs.readFileSync(path.join(folder.workingDir, "description.md"), "utf-8");
    const instrContent = fs.readFileSync(path.join(folder.workingDir, "instructions.md"), "utf-8");

    // Extract a clean agent name from the description (first line or sentence)
    const agentDisplayName = this._extractAgentName(descContent, folder.agentName);

    // Check for existing agent with same name (idempotency)
    const existingAgents = this.agentManager.listAgents();
    const existing = existingAgents.find(a => a.name === agentDisplayName);

    let agent;
    if (existing) {
      agent = existing;
    } else {
      agent = this.agentManager.createAgent({
        name: agentDisplayName,
        description: descContent.trim(),
        system_prompt: instrContent.trim(),
        domain: this._inferDomain(folder.agentName),
        status: "active",
        added_by: "manus",
      });
    }

    // Populate KB from knowledge_base files
    const kbDir = path.join(folder.workingDir, "knowledge_base");
    let kbEntries = 0;
    let chunksIndexed = 0;

    if (fs.existsSync(kbDir)) {
      const kbFiles = fs.readdirSync(kbDir).filter(f => f.endsWith(".md"));

      for (const filename of kbFiles) {
        const filePath = path.join(kbDir, filename);
        const content = fs.readFileSync(filePath, "utf-8");

        // Classify priority using signal stacking
        const relativePath = `knowledge_base/${filename}`;
        const priority = this.classifier.classify(relativePath, {}, content);

        // Create KB document
        const doc = this.agentManager.addKnowledgeDocument(agent.id, {
          filename,
          file_type: "md",
          file_size: content.length,
          source_type: "manus_research",
          added_by: "manus",
          priority,
          metadata: { content, source: "manus_session_ingest" },
        });

        // Index into RAG
        let docChunks = 0;
        if (this.rag) {
          const chunkCount = this.rag.indexDocument(agent.id, doc.id, content, {
            filename,
            file_type: "md",
            source: "manus_research",
          });
          docChunks = typeof chunkCount === "number" ? chunkCount : 0;
          this.agentManager.updateKnowledgeDocument(doc.id, { chunk_count: docChunks });
        }

        kbEntries++;
        chunksIndexed += docChunks;
      }
    }

    return {
      agentId: agent.id,
      agentName: agentDisplayName,
      kbEntries,
      chunksIndexed,
    };
  }

  /**
   * Extract a human-readable agent name from description.md content.
   * Falls back to folder name with underscores replaced by spaces.
   * @private
   */
  _extractAgentName(descContent, folderName) {
    // Try to extract name from the first line/sentence of description
    // Pattern: "Cleveland Public Safety Director Assistant — ..."
    const firstLine = descContent.split("\n")[0].trim();
    if (firstLine.length > 0 && firstLine.length < 120) {
      // Use the part before any dash/em-dash as the name, or the whole line if short enough
      const dashIdx = firstLine.search(/\s*[—–-]\s*/);
      if (dashIdx > 0 && dashIdx < 80) {
        return firstLine.substring(0, dashIdx).trim();
      }
      if (firstLine.length < 60) return firstLine;
    }

    // Fallback: convert folder name like GPT_01_Urban_AI_Director to "Urban AI Director"
    return folderName
      .replace(/^GPT_\d+_/, "")
      .replace(/_/g, " ");
  }

  /**
   * Infer a domain string from the folder name.
   * @private
   */
  _inferDomain(agentName) {
    const lower = agentName.toLowerCase();
    if (lower.includes("safety") || lower.includes("police")) return "public-safety";
    if (lower.includes("health")) return "public-health";
    if (lower.includes("utility") || lower.includes("utilities")) return "utilities";
    if (lower.includes("parks") || lower.includes("recreation")) return "parks";
    if (lower.includes("finance") || lower.includes("budget")) return "finance";
    if (lower.includes("housing") || lower.includes("building")) return "building-housing";
    if (lower.includes("communication")) return "communications";
    if (lower.includes("council")) return "council";
    if (lower.includes("concierge") || lower.includes("director")) return "governance";
    return "General";
  }
}

module.exports = { ManusSessionIngest };
