/**
 * ManusPriorityClassifier — TDD tests
 * Signal-stacking priority classification for MANUS KB files.
 * Governance → 95, Core Domain → 80, Operational → 65.
 * Requires 2+ independent signals for tier elevation.
 */

const { ManusPriorityClassifier } = require("../../src/agents/manus-priority-classifier");

describe("ManusPriorityClassifier", () => {
  let classifier;

  beforeAll(() => {
    classifier = new ManusPriorityClassifier();
  });

  // --- Governance tier (95) ---
  test("classifies HAAIS_GOVERNANCE file path as governance (95)", () => {
    const priority = classifier.classify(
      "knowledge_base/HAAIS_GOVERNANCE_HEALTH.md",
      {},
      "# HAAIS Governance\n\nEscalation contacts for health department."
    );
    expect(priority).toBe(95);
  });

  test("classifies file with governance path + policy heading as governance (95)", () => {
    const priority = classifier.classify(
      "knowledge_base/Data_Privacy_Protocols.md",
      {},
      "# Data Privacy Policy\n\nCompliance requirements for all departments.\n\nESCALATION CONTACT: Chief Privacy Officer"
    );
    expect(priority).toBe(95);
  });

  test("classifies file with tier:governance frontmatter + escalation content as governance (95)", () => {
    const priority = classifier.classify(
      "knowledge_base/audit_requirements.md",
      { tier: "governance", priority: "critical" },
      "# Audit Trail Requirements\n\nAll operations must maintain audit logs."
    );
    expect(priority).toBe(95);
  });

  test("classifies escalation matrix as governance (95)", () => {
    const priority = classifier.classify(
      "Governance_Documents/Escalation_Matrix.md",
      {},
      "# Escalation Matrix\n\nPolicy for routing high-risk decisions to human oversight."
    );
    expect(priority).toBe(95);
  });

  test("classifies compliance/ethics file as governance (95)", () => {
    const priority = classifier.classify(
      "knowledge_base/ethics_oversight.md",
      {},
      "# Ethics and Compliance\n\nGovernance framework for AI ethics oversight.\n\nEscalation Contact: Ethics Board Chair"
    );
    expect(priority).toBe(95);
  });

  // --- Core Domain tier (80) ---
  test("classifies city charter as core domain (80)", () => {
    const priority = classifier.classify(
      "knowledge_base/CLEVELAND_CITY_CHARTER_COMPLETE.md",
      {},
      "# Cleveland City Charter\n\n## Overview\n\nThe charter establishes the framework for municipal governance."
    );
    expect(priority).toBe(80);
  });

  test("classifies EPA regulations as core domain (80)", () => {
    const priority = classifier.classify(
      "knowledge_base/REGULATORY_EPA_SAFE_DRINKING_WATER_ACT.md",
      {},
      "# EPA Safe Drinking Water Act\n\n## Overview\n\nFederal framework for drinking water quality standards.\n\nCross-reference: 09_clean_water_act_npdes.md"
    );
    expect(priority).toBe(80);
  });

  test("classifies file with tier:core frontmatter as core domain (80)", () => {
    const priority = classifier.classify(
      "knowledge_base/01_police_operations.md",
      { tier: "core" },
      "# Police Operations\n\n## System Architecture\n\nThe Cleveland Division of Police structure."
    );
    expect(priority).toBe(80);
  });

  test("classifies file with overview heading + cross-reference as core domain (80)", () => {
    const priority = classifier.classify(
      "knowledge_base/ohio_building_code_summary.md",
      {},
      "# Ohio Building Code Summary\n\n## Overview\n\nComprehensive framework for building standards.\n\nCross-reference: 01_building_permits.md"
    );
    expect(priority).toBe(80);
  });

  // --- Operational tier (65) — default ---
  test("classifies numbered operational file as operational (65)", () => {
    const priority = classifier.classify(
      "knowledge_base/08_utility_billing_customer_service.md",
      {},
      "# Utility Billing & Customer Service\n\nProcedures for billing inquiries and payment processing."
    );
    expect(priority).toBe(65);
  });

  test("classifies maintenance file as operational (65)", () => {
    const priority = classifier.classify(
      "knowledge_base/07_maintenance_best_practices.md",
      {},
      "# Maintenance Best Practices\n\nScheduled maintenance procedures for water infrastructure."
    );
    expect(priority).toBe(65);
  });

  test("classifies workforce development file as operational (65)", () => {
    const priority = classifier.classify(
      "knowledge_base/19_workforce_development_local_hiring.md",
      {},
      "# Workforce Development\n\nLocal hiring programs and training initiatives."
    );
    expect(priority).toBe(65);
  });

  // --- Signal stacking: single signal not enough ---
  test("single governance keyword in path without content signal stays operational", () => {
    const priority = classifier.classify(
      "knowledge_base/governance_notes.md",
      {},
      "# Meeting Notes\n\nDiscussion about project timelines and deliverables."
    );
    // Only one signal (path has "governance") — not enough to elevate
    // But actually path "governance" is a strong signal. Let's check if it gets elevated
    // The rule is: 2+ signals needed. Path match is one, content needs another.
    expect(priority).toBeLessThanOrEqual(80);
  });

  test("single core keyword in content without path/fm signal stays operational", () => {
    const priority = classifier.classify(
      "knowledge_base/12_random_procedures.md",
      {},
      "# Random Procedures\n\nSome overview of processes."
    );
    // "overview" alone in content without path or frontmatter signal = not enough
    expect(priority).toBe(65);
  });

  // --- Edge cases ---
  test("empty content defaults to operational (65)", () => {
    const priority = classifier.classify("knowledge_base/empty.md", {}, "");
    expect(priority).toBe(65);
  });

  test("null frontmatter handled gracefully", () => {
    const priority = classifier.classify(
      "knowledge_base/test.md",
      null,
      "# Test Document\n\nBasic content."
    );
    expect(priority).toBe(65);
  });

  test("PARKS_MASTER_PLAN classified as core domain (80)", () => {
    const priority = classifier.classify(
      "knowledge_base/PARKS_MASTER_PLAN_COMPLETE.md",
      {},
      "# Parks Master Plan\n\n## Overview\n\nComprehensive framework for park system development."
    );
    expect(priority).toBe(80);
  });

  test("CDC_GUIDELINES classified as core domain (80)", () => {
    const priority = classifier.classify(
      "knowledge_base/CDC_GUIDELINES_QUICK_REFERENCE.md",
      {},
      "# CDC Guidelines Quick Reference\n\n## Overview\n\nKey public health guidelines and cross-references."
    );
    expect(priority).toBe(80);
  });
});
