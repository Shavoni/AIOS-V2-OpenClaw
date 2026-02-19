/**
 * Agent Branding — TDD tests
 * Per-agent logo, brand color, and tagline support.
 */

const { createTestDb } = require("../fixtures/test-db");
const { AgentManagerService } = require("../../src/agents/manager");

describe("Agent Branding", () => {
  let db, manager;

  beforeAll(async () => {
    db = await createTestDb();
    manager = new AgentManagerService(db, jest.fn());
  });

  afterAll(() => { if (db) db.close(); });

  test("createAgent accepts logo_url, brand_color, brand_tagline", () => {
    const agent = manager.createAgent({
      name: "Branded Agent",
      domain: "public-safety",
      logo_url: "/uploads/safety-logo.png",
      brand_color: "#E74C3C",
      brand_tagline: "Protecting Cleveland",
    });

    expect(agent.logo_url).toBe("/uploads/safety-logo.png");
    expect(agent.brand_color).toBe("#E74C3C");
    expect(agent.brand_tagline).toBe("Protecting Cleveland");
  });

  test("createAgent defaults branding fields to empty strings", () => {
    const agent = manager.createAgent({
      name: "No Branding Agent",
      domain: "general",
    });

    expect(agent.logo_url).toBe("");
    expect(agent.brand_color).toBe("");
    expect(agent.brand_tagline).toBe("");
  });

  test("updateAgent can set logo_url", () => {
    const agent = manager.createAgent({ name: "Logo Test" });
    const updated = manager.updateAgent(agent.id, {
      logo_url: "/uploads/new-logo.svg",
    });

    expect(updated.logo_url).toBe("/uploads/new-logo.svg");
  });

  test("updateAgent can set brand_color", () => {
    const agent = manager.createAgent({ name: "Color Test" });
    const updated = manager.updateAgent(agent.id, {
      brand_color: "#2ECC71",
    });

    expect(updated.brand_color).toBe("#2ECC71");
  });

  test("updateAgent can set brand_tagline", () => {
    const agent = manager.createAgent({ name: "Tagline Test" });
    const updated = manager.updateAgent(agent.id, {
      brand_tagline: "Innovation for the city",
    });

    expect(updated.brand_tagline).toBe("Innovation for the city");
  });

  test("updateAgent can update all branding fields at once", () => {
    const agent = manager.createAgent({ name: "Full Brand Test" });
    const updated = manager.updateAgent(agent.id, {
      logo_url: "/uploads/logo.png",
      brand_color: "#3498DB",
      brand_tagline: "Smart City Solutions",
    });

    expect(updated.logo_url).toBe("/uploads/logo.png");
    expect(updated.brand_color).toBe("#3498DB");
    expect(updated.brand_tagline).toBe("Smart City Solutions");
  });

  test("getAgent returns branding fields", () => {
    const agent = manager.createAgent({
      name: "Get Brand Test",
      logo_url: "/uploads/test.png",
      brand_color: "#9B59B6",
      brand_tagline: "Test tagline",
    });

    const fetched = manager.getAgent(agent.id);
    expect(fetched.logo_url).toBe("/uploads/test.png");
    expect(fetched.brand_color).toBe("#9B59B6");
    expect(fetched.brand_tagline).toBe("Test tagline");
  });

  test("listAgents includes branding fields", () => {
    manager.createAgent({
      name: "Listed Brand Agent",
      logo_url: "/uploads/listed.png",
      brand_color: "#F39C12",
      brand_tagline: "Listed agent",
    });

    const agents = manager.listAgents();
    const found = agents.find(a => a.name === "Listed Brand Agent");
    expect(found).toBeTruthy();
    expect(found.logo_url).toBe("/uploads/listed.png");
    expect(found.brand_color).toBe("#F39C12");
  });
});
