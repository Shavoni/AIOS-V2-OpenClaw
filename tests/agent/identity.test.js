const path = require("path");
const { AgentIdentity } = require("../../src/agent/identity");

describe("AgentIdentity", () => {
  test("loads identity from project root", () => {
    const identity = new AgentIdentity(path.resolve(__dirname, "../.."));
    identity.load();
    expect(identity.name).toBe("Scotty-5");
    expect(identity.emoji).toBeTruthy();
  });

  test("provides a summary", () => {
    const identity = new AgentIdentity(path.resolve(__dirname, "../.."));
    identity.load();
    const summary = identity.getSummary();
    expect(summary).toContain("Scotty-5");
  });

  test("loads soul file", () => {
    const identity = new AgentIdentity(path.resolve(__dirname, "../.."));
    identity.load();
    expect(identity.soul.length).toBeGreaterThan(0);
  });

  test("handles missing files gracefully", () => {
    const identity = new AgentIdentity("/nonexistent/path");
    identity.load();
    expect(identity.name).toBe("Scotty-5"); // Falls back to default
  });
});
