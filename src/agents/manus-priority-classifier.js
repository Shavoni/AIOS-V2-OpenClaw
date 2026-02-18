/**
 * ManusPriorityClassifier — Signal-stacking priority classification for MANUS KB files.
 *
 * Three tiers:
 *   Governance → 95  (HAAIS frameworks, escalation matrices, compliance/ethics)
 *   Core Domain → 80  (charters, regulations, master plans, system architecture)
 *   Operational → 65  (procedures, maintenance, workforce, numbered SOP files)
 *
 * Requires 2+ independent signals for tier elevation above operational.
 * Signals come from: filepath patterns, frontmatter metadata, content headings/keywords.
 */

// --- Signal patterns ---

const GOVERNANCE_PATH_PATTERNS = [
  /haais/i,
  /governance/i,
  /escalation/i,
  /compliance/i,
  /ethics/i,
  /audit/i,
  /privacy/i,
];

const GOVERNANCE_CONTENT_PATTERNS = [
  /escalation\s+contact/i,
  /\bpolicy\b/i,
  /human\s+oversight/i,
  /compliance\s+require/i,
  /governance\s+framework/i,
  /ethics\s+(and\s+)?compliance/i,
  /audit\s+(trail|log)/i,
  /escalation\s+matrix/i,
];

const CORE_PATH_PATTERNS = [
  /charter/i,
  /regulatory/i,
  /epa/i,
  /cdc/i,
  /master_plan/i,
  /complete/i,
  /framework/i,
];

const CORE_CONTENT_PATTERNS = [
  /##\s*overview/i,
  /comprehensive\s+framework/i,
  /cross-reference/i,
  /system\s+architecture/i,
  /federal\s+framework/i,
];

class ManusPriorityClassifier {
  /**
   * Classify a knowledge base file into a priority tier using signal stacking.
   *
   * @param {string} filepath - Relative path of the file (e.g. "knowledge_base/HAAIS_GOVERNANCE_CORE.md")
   * @param {Object|null} frontmatter - Parsed frontmatter metadata (may contain tier, priority keys)
   * @param {string} content - Raw text content of the file
   * @returns {number} Priority value: 95 (governance), 80 (core domain), or 65 (operational)
   */
  classify(filepath, frontmatter, content) {
    const fm = frontmatter || {};
    const govSignals = this._countGovernanceSignals(filepath, fm, content);
    const coreSignals = this._countCoreSignals(filepath, fm, content);

    // Governance: 2+ governance signals
    if (govSignals >= 2) return 95;

    // Core Domain: 2+ core signals
    if (coreSignals >= 2) return 80;

    // Default: Operational
    return 65;
  }

  /**
   * Count independent governance-tier signals from path, frontmatter, and content.
   * @private
   */
  _countGovernanceSignals(filepath, fm, content) {
    let signals = 0;

    // Signal 1: Path contains governance keywords
    if (GOVERNANCE_PATH_PATTERNS.some(p => p.test(filepath))) {
      signals++;
    }

    // Signal 2: Frontmatter declares governance tier or critical priority
    if (
      (fm.tier && fm.tier.toLowerCase() === "governance") ||
      (fm.priority && fm.priority === "critical")
    ) {
      signals++;
    }

    // Signal 3: Content contains governance keywords (escalation contacts, policy headings, etc.)
    if (GOVERNANCE_CONTENT_PATTERNS.some(p => p.test(content))) {
      signals++;
    }

    return signals;
  }

  /**
   * Count independent core-domain signals from path, frontmatter, and content.
   * @private
   */
  _countCoreSignals(filepath, fm, content) {
    let signals = 0;

    // Signal 1: Path contains core-domain keywords (charter, regulatory, EPA, master plan, etc.)
    if (CORE_PATH_PATTERNS.some(p => p.test(filepath))) {
      signals++;
    }

    // Signal 2: Frontmatter declares core tier
    if (fm.tier && fm.tier.toLowerCase() === "core") {
      signals++;
    }

    // Signal 3+: Content contains core structural patterns (each distinct match counts)
    // This allows "## Overview" + "Cross-reference" in the same doc to produce 2 signals
    for (const pattern of CORE_CONTENT_PATTERNS) {
      if (pattern.test(content)) {
        signals++;
      }
    }

    return signals;
  }
}

module.exports = { ManusPriorityClassifier };
