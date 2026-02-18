const { SkillRegistry } = require("../../src/skills/registry");

describe("SkillRegistry", () => {
  let registry;

  beforeEach(() => {
    registry = new SkillRegistry();
  });

  test("registers and retrieves a skill", () => {
    registry.register({ id: "test", name: "Test", description: "Test skill", tags: [], capabilities: [] });
    expect(registry.get("test")).toBeTruthy();
    expect(registry.get("test").name).toBe("Test");
  });

  test("returns null for unknown skill", () => {
    expect(registry.get("unknown")).toBeNull();
  });

  test("lists all skills", () => {
    registry.register({ id: "a", name: "A", description: "", tags: [], capabilities: [] });
    registry.register({ id: "b", name: "B", description: "", tags: [], capabilities: [] });
    expect(registry.getAll()).toHaveLength(2);
  });

  test("finds skills by keyword", () => {
    registry.register({ id: "deploy", name: "Deploy", description: "Deploy apps", tags: ["devops"], capabilities: [] });
    registry.register({ id: "email", name: "Email", description: "Send emails", tags: ["comms"], capabilities: [] });
    const results = registry.findByKeyword("deploy");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("deploy");
  });

  test("returns skill count", () => {
    registry.register({ id: "a", name: "A", description: "", tags: [], capabilities: [] });
    expect(registry.getSkillCount()).toBe(1);
  });

  test("generates markdown summary", () => {
    registry.register({ id: "a", name: "A", description: "Does A", tags: [], capabilities: [] });
    const summary = registry.getSummary();
    expect(summary).toContain("**A**");
    expect(summary).toContain("Does A");
  });
});
