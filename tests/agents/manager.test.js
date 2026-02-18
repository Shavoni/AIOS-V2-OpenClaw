const { AgentManagerService } = require("../../src/agents/manager");

describe("AgentManagerService", () => {
  let db, manager;

  beforeAll(async () => {
    const initSqlJs = require("sql.js");
    const SQL = await initSqlJs();
    db = new SQL.Database();
    db.run("PRAGMA foreign_keys = ON");

    const { initSchema } = require("../../src/db/schema");
    initSchema(db);

    manager = new AgentManagerService(db, () => {});
  });

  afterAll(() => {
    if (db) db.close();
  });

  describe("CRUD operations", () => {
    let agentId;

    test("creates an agent", () => {
      const agent = manager.createAgent({
        name: "Legal Advisor",
        title: "Contract Specialist",
        domain: "Legal",
        description: "Reviews contracts and legal documents",
        capabilities: ["contract review", "compliance check"],
        guardrails: ["no legal advice disclaimer"],
        system_prompt: "You are a legal review specialist.",
      });

      expect(agent.id).toBeTruthy();
      expect(agent.name).toBe("Legal Advisor");
      expect(agent.domain).toBe("Legal");
      expect(agent.status).toBe("active");
      agentId = agent.id;
    });

    test("lists all agents", () => {
      const agents = manager.listAgents();
      expect(agents.length).toBeGreaterThanOrEqual(1);
      const found = agents.find((a) => a.id === agentId);
      expect(found).toBeTruthy();
      expect(found.name).toBe("Legal Advisor");
    });

    test("gets a single agent", () => {
      const agent = manager.getAgent(agentId);
      expect(agent.name).toBe("Legal Advisor");
      expect(agent.capabilities).toContain("contract review");
      expect(agent.guardrails).toContain("no legal advice disclaimer");
    });

    test("returns null for nonexistent agent", () => {
      const agent = manager.getAgent("nonexistent-id");
      expect(agent).toBeNull();
    });

    test("updates an agent", () => {
      const updated = manager.updateAgent(agentId, {
        title: "Senior Contract Specialist",
        description: "Senior legal specialist for complex contracts",
      });
      expect(updated.title).toBe("Senior Contract Specialist");
    });

    test("disables an agent", () => {
      manager.disableAgent(agentId);
      const agent = manager.getAgent(agentId);
      expect(agent.status).toBe("disabled");
    });

    test("enables an agent", () => {
      manager.enableAgent(agentId);
      const agent = manager.getAgent(agentId);
      expect(agent.status).toBe("active");
    });

    test("lists active agents only", () => {
      manager.createAgent({ name: "Disabled Bot", status: "disabled" });
      const active = manager.getActiveAgents();
      expect(active.every((a) => a.status === "active")).toBe(true);
    });

    test("deletes an agent", () => {
      const temp = manager.createAgent({ name: "Temp Agent" });
      manager.deleteAgent(temp.id);
      const result = manager.getAgent(temp.id);
      expect(result).toBeNull();
    });
  });

  describe("knowledge documents", () => {
    let agentId;

    beforeAll(() => {
      const agent = manager.createAgent({ name: "Knowledge Agent" });
      agentId = agent.id;
    });

    test("adds a knowledge document", () => {
      const doc = manager.addKnowledgeDocument(agentId, {
        filename: "contract-guide.pdf",
        file_type: "pdf",
        file_size: 1024,
        chunk_count: 5,
      });
      expect(doc.id).toBeTruthy();
      expect(doc.filename).toBe("contract-guide.pdf");
    });

    test("lists knowledge documents", () => {
      const docs = manager.listKnowledgeDocuments(agentId);
      expect(docs.length).toBeGreaterThanOrEqual(1);
    });

    test("deletes a knowledge document", () => {
      const doc = manager.addKnowledgeDocument(agentId, {
        filename: "temp.txt",
        file_type: "txt",
      });
      manager.deleteKnowledgeDocument(doc.id);
      const docs = manager.listKnowledgeDocuments(agentId);
      expect(docs.find((d) => d.id === doc.id)).toBeUndefined();
    });
  });

  describe("web sources", () => {
    let agentId;

    beforeAll(() => {
      const agent = manager.createAgent({ name: "Web Agent" });
      agentId = agent.id;
    });

    test("adds a web source", () => {
      const src = manager.addWebSource(agentId, {
        url: "https://example.com/docs",
        name: "Example Docs",
        description: "Documentation site",
      });
      expect(src.id).toBeTruthy();
      expect(src.url).toBe("https://example.com/docs");
    });

    test("lists web sources", () => {
      const sources = manager.listWebSources(agentId);
      expect(sources.length).toBeGreaterThanOrEqual(1);
    });

    test("deletes a web source", () => {
      const src = manager.addWebSource(agentId, {
        url: "https://temp.com",
        name: "Temp",
      });
      manager.deleteWebSource(src.id);
      const sources = manager.listWebSources(agentId);
      expect(sources.find((s) => s.id === src.id)).toBeUndefined();
    });
  });

  describe("concierge routing", () => {
    test("regenerates concierge agent", () => {
      manager.createAgent({ name: "HR Bot", domain: "HR", capabilities: ["hiring"], status: "active" });
      manager.createAgent({ name: "Finance Bot", domain: "Finance", capabilities: ["budgets"], status: "active" });

      const concierge = manager.regenerateConcierge();
      expect(concierge).toBeTruthy();
      expect(concierge.is_router).toBe(1);
      expect(concierge.name).toContain("Concierge");
    });

    test("routes query to best agent", () => {
      const result = manager.routeQuery("I need help with the hiring process");
      expect(result).toBeTruthy();
      expect(result.agent).toBeTruthy();
    });

    test("routes to fallback when no match", () => {
      const result = manager.routeQuery("xyzzy something totally unrelated");
      expect(result.agent).toBeTruthy(); // falls back to first active agent
    });
  });
});
