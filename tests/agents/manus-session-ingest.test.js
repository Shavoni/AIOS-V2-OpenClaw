/**
 * ManusSessionIngest — TDD tests
 * Directory-to-agent pipeline: scan MANUS folder structure, validate manifest,
 * create agents from description.md/instructions.md, populate KBs from
 * knowledge_base/*.md with priority classification and RAG indexing.
 */

const path = require("path");
const fs = require("fs");
const os = require("os");
const { createTestDb } = require("../fixtures/test-db");
const { AgentManagerService } = require("../../src/agents/manager");
const { RAGPipeline } = require("../../src/rag");
const { DocumentParser } = require("../../src/rag/document-parser");
const { ManusSessionIngest } = require("../../src/agents/manus-session-ingest");

// Create a temporary MANUS-style directory structure for testing
function createMockManusSession(baseDir) {
  // GPT 01 — Urban AI Director
  const gpt01 = path.join(baseDir, "1. GPT_01_Urban_AI_Director");
  const gpt01Inner = path.join(gpt01, "GPT_01_Urban_AI_Director");
  const gpt01KB = path.join(gpt01Inner, "knowledge_base");
  fs.mkdirSync(gpt01KB, { recursive: true });

  fs.writeFileSync(path.join(gpt01Inner, "description.md"),
    "Cleveland Urban AI Director Assistant — HAAIS-governed AI strategy and governance support for Dr. Elizabeth Crowe.");
  fs.writeFileSync(path.join(gpt01Inner, "instructions.md"),
    "# Urban AI Director Instructions\n\nYou are the Urban AI Director assistant. Operate under HAAIS governance.\n\n## Capabilities\n- AI governance and compliance\n- Cross-departmental coordination\n- Data ethics oversight");

  fs.writeFileSync(path.join(gpt01KB, "HAAIS_GOVERNANCE_CORE.md"),
    "# HAAIS Governance Core\n\n## Policy\n\nAll AI systems must maintain human oversight.\n\nEscalation Contact: Dr. Elizabeth Crowe");
  fs.writeFileSync(path.join(gpt01KB, "01_ai_strategy.md"),
    "# AI Strategy\n\n## Overview\n\nCleveland's AI strategy framework for municipal innovation.");
  fs.writeFileSync(path.join(gpt01KB, "02_data_ethics.md"),
    "# Data Ethics\n\nProtocols for responsible data use in city operations.");

  // GPT 08 — Public Safety
  const gpt08 = path.join(baseDir, "8. GPT_08_Public_Safety");
  const gpt08Inner = path.join(gpt08, "GPT_08_Public_Safety");
  const gpt08KB = path.join(gpt08Inner, "knowledge_base");
  fs.mkdirSync(gpt08KB, { recursive: true });

  fs.writeFileSync(path.join(gpt08Inner, "description.md"),
    "Cleveland Public Safety Director Assistant — Crime analysis and DOJ Consent Decree compliance support.");
  fs.writeFileSync(path.join(gpt08Inner, "instructions.md"),
    "# Public Safety Instructions\n\nYou are the Public Safety assistant.\n\n## Capabilities\n- Crime data analysis\n- DOJ Consent Decree compliance\n- Resource allocation");

  fs.writeFileSync(path.join(gpt08KB, "HAAIS_GOVERNANCE_SAFETY.md"),
    "# HAAIS Governance — Public Safety\n\n## Policy\n\nNo operational control of personnel.\n\nEscalation Contact: Chief of Police");
  fs.writeFileSync(path.join(gpt08KB, "01_police_operations.md"),
    "# Police Operations\n\n## Overview\n\nThe Cleveland Division of Police is the largest law enforcement agency in Ohio.\n\nCross-reference: 02_fire_ems.md");
  fs.writeFileSync(path.join(gpt08KB, "02_fire_ems.md"),
    "# Fire & EMS Services\n\nEmergency response procedures and staffing.");
  fs.writeFileSync(path.join(gpt08KB, "05_use_of_force_policies.md"),
    "# Use of Force Policies\n\nDOJ Consent Decree compliance requirements.\n\nEscalation Contact: Internal Affairs");

  // Invalid folder — missing description.md
  const invalid = path.join(baseDir, "99. GPT_99_Invalid");
  const invalidInner = path.join(invalid, "GPT_99_Invalid");
  fs.mkdirSync(path.join(invalidInner, "knowledge_base"), { recursive: true });
  // No description.md, no instructions.md
  fs.writeFileSync(path.join(invalidInner, "knowledge_base", "01_test.md"), "# Test\n\nSome content.");

  // Non-GPT folder (should be ignored)
  fs.mkdirSync(path.join(baseDir, "9. GOVERNANCE_DOCUMENTS", "Governance_Documents"), { recursive: true });
  fs.writeFileSync(path.join(baseDir, "9. GOVERNANCE_DOCUMENTS", "Governance_Documents", "HAAIS_Master_Framework.md"),
    "# HAAIS Master Framework\n\nSystem-wide governance.");

  return baseDir;
}

describe("ManusSessionIngest", () => {
  let db, manager, rag, parser, sessionIngest, tmpDir;

  beforeAll(async () => {
    db = await createTestDb();
    manager = new AgentManagerService(db, jest.fn());
    rag = new RAGPipeline(manager, null);
    parser = new DocumentParser();
    sessionIngest = new ManusSessionIngest({ agentManager: manager, rag, documentParser: parser });

    // Create temp MANUS directory
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "manus-test-"));
    createMockManusSession(tmpDir);
  });

  afterAll(() => {
    if (db) db.close();
    // Cleanup temp dir
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // --- Manifest parsing ---
  test("parseManifest detects all numbered GPT folders", async () => {
    const manifest = await sessionIngest.parseManifest(tmpDir);
    // Should find GPT_01, GPT_08, GPT_99 (3 numbered folders)
    expect(manifest.folders.length).toBeGreaterThanOrEqual(3);
  });

  test("parseManifest marks valid folders with description.md + instructions.md", async () => {
    const manifest = await sessionIngest.parseManifest(tmpDir);
    const valid = manifest.folders.filter(f => f.isValid);
    expect(valid.length).toBe(2); // GPT_01 and GPT_08
  });

  test("parseManifest marks folders without description.md as invalid", async () => {
    const manifest = await sessionIngest.parseManifest(tmpDir);
    const invalid = manifest.folders.filter(f => !f.isValid);
    expect(invalid.length).toBeGreaterThanOrEqual(1);
    expect(invalid[0].validationErrors).toEqual(
      expect.arrayContaining([expect.stringContaining("description")])
    );
  });

  test("parseManifest counts knowledge_base files per folder", async () => {
    const manifest = await sessionIngest.parseManifest(tmpDir);
    const gpt01 = manifest.folders.find(f => f.agentName.includes("Urban_AI"));
    expect(gpt01.kbFileCount).toBe(3);

    const gpt08 = manifest.folders.find(f => f.agentName.includes("Public_Safety"));
    expect(gpt08.kbFileCount).toBe(4);
  });

  test("parseManifest returns summary stats", async () => {
    const manifest = await sessionIngest.parseManifest(tmpDir);
    expect(manifest.totalFolders).toBeGreaterThanOrEqual(3);
    expect(manifest.validFolders).toBe(2);
    expect(manifest.invalidFolders).toBeGreaterThanOrEqual(1);
    expect(manifest.totalKBFiles).toBeGreaterThanOrEqual(7);
  });

  test("parseManifest ignores non-GPT folders like GOVERNANCE_DOCUMENTS", async () => {
    const manifest = await sessionIngest.parseManifest(tmpDir);
    const govFolder = manifest.folders.find(f => f.agentName.includes("GOVERNANCE_DOCUMENTS"));
    // GOVERNANCE_DOCUMENTS should not be picked up as a GPT folder
    expect(govFolder).toBeUndefined();
  });

  // --- Full session ingest ---
  test("ingestSession creates agents from valid folders", async () => {
    const result = await sessionIngest.ingestSession(tmpDir);
    expect(result.agentsCreated).toBe(2);
    expect(result.agentsFailed).toBe(0);
  });

  test("ingestSession creates agent with name from description.md", async () => {
    const result = await sessionIngest.ingestSession(tmpDir);
    const agents = manager.listAgents();
    const aiDirector = agents.find(a => a.name.includes("Urban AI Director"));
    expect(aiDirector).toBeTruthy();
  });

  test("ingestSession stores instructions.md content as system_prompt", async () => {
    const result = await sessionIngest.ingestSession(tmpDir);
    const agents = manager.listAgents();
    const safetyAgent = agents.find(a => a.name.includes("Public Safety"));
    expect(safetyAgent).toBeTruthy();
    // system_prompt should contain the instructions
    const agent = manager.getAgent(safetyAgent.id);
    expect(agent.system_prompt || agent.instructions).toContain("Crime data analysis");
  });

  test("ingestSession populates KB with all knowledge_base files", async () => {
    const result = await sessionIngest.ingestSession(tmpDir);
    expect(result.totalKBEntriesCreated).toBeGreaterThanOrEqual(7);
  });

  test("ingestSession applies priority classification to KB entries", async () => {
    const result = await sessionIngest.ingestSession(tmpDir);
    const agents = manager.listAgents();
    const safetyAgent = agents.find(a => a.name.includes("Public Safety"));
    const docs = manager.listKnowledgeDocuments(safetyAgent.id);

    // Governance file should have priority 95
    const govDoc = docs.find(d => d.filename.includes("GOVERNANCE"));
    expect(govDoc.priority).toBe(95);

    // Core domain file should have priority 80
    const coreDoc = docs.find(d => d.filename.includes("police_operations"));
    expect(coreDoc.priority).toBe(80);

    // Operational file should have priority 65
    const opDoc = docs.find(d => d.filename.includes("fire_ems"));
    expect(opDoc.priority).toBe(65);
  });

  test("ingestSession indexes KB entries into RAG for search", async () => {
    const result = await sessionIngest.ingestSession(tmpDir);
    const agents = manager.listAgents();
    const safetyAgent = agents.find(a => a.name.includes("Public Safety"));

    const results = rag.search.search(safetyAgent.id, "DOJ Consent Decree compliance", 5);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  test("ingestSession tags all documents as manus_research source_type", async () => {
    const result = await sessionIngest.ingestSession(tmpDir);
    const agents = manager.listAgents();
    const aiAgent = agents.find(a => a.name.includes("Urban AI Director"));
    const docs = manager.listKnowledgeDocuments(aiAgent.id);
    expect(docs.every(d => d.source_type === "manus_research")).toBe(true);
  });

  test("ingestSession skips invalid folders without crashing", async () => {
    const result = await sessionIngest.ingestSession(tmpDir);
    expect(result.foldersSkipped).toBeGreaterThanOrEqual(1);
    // Should still have created the valid agents
    expect(result.agentsCreated).toBe(2);
  });

  test("ingestSession returns per-agent detail in results", async () => {
    const result = await sessionIngest.ingestSession(tmpDir);
    expect(result.agents).toHaveLength(2);
    expect(result.agents[0]).toHaveProperty("agentId");
    expect(result.agents[0]).toHaveProperty("kbEntries");
    expect(result.agents[0]).toHaveProperty("chunksIndexed");
  });

  test("ingestSession sets agents to active status", async () => {
    const result = await sessionIngest.ingestSession(tmpDir);
    const agents = manager.listAgents();
    const created = agents.filter(a => a.source === "manus_ingest" || a.added_by === "manus");
    for (const agent of result.agents) {
      const a = manager.getAgent(agent.agentId);
      expect(a.status).toBe("active");
    }
  });

  // --- Idempotency ---
  test("ingestSession does not duplicate agents on re-run", async () => {
    const before = manager.listAgents().length;
    await sessionIngest.ingestSession(tmpDir);
    const after = manager.listAgents().length;
    // Should not create additional agents on second run
    expect(after).toBe(before);
  });
});
