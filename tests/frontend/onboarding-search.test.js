/**
 * RED — Onboarding Wizard: Live Search Bar
 * Tests the search + filter combination in Step 5 (Select Agents).
 */

function filterAgents(agents, domain, searchQuery) {
  let filtered = domain === "All" ? [...agents] : agents.filter((a) => a.domain === domain);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter((a) => a.name.toLowerCase().includes(q));
  }
  return filtered;
}

const MOCK_AGENTS = [
  { id: "1", name: "HR Agent", domain: "HR", enabled: true },
  { id: "2", name: "Finance Agent", domain: "Finance", enabled: true },
  { id: "3", name: "Legal Agent", domain: "Legal", enabled: true },
  { id: "4", name: "HR Benefits", domain: "HR", enabled: true },
  { id: "5", name: "Public Safety", domain: "PublicSafety", enabled: true },
  { id: "6", name: "IT Support", domain: "IT", enabled: false },
];

describe("Onboarding Live Search", () => {
  it("should filter agents by name (case-insensitive)", () => {
    const results = filterAgents(MOCK_AGENTS, "All", "hr");
    expect(results.length).toBe(2);
    expect(results[0].name).toBe("HR Agent");
    expect(results[1].name).toBe("HR Benefits");
  });

  it("should combine search with chip filter (AND logic)", () => {
    // Search for "agent" within HR domain
    const results = filterAgents(MOCK_AGENTS, "HR", "agent");
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("HR Agent");
  });

  it("should show all agents for active chip when search is empty", () => {
    const results = filterAgents(MOCK_AGENTS, "Finance", "");
    expect(results.length).toBe(1);
    expect(results[0].domain).toBe("Finance");
  });

  it("should return empty when no matches", () => {
    const results = filterAgents(MOCK_AGENTS, "All", "nonexistent");
    expect(results.length).toBe(0);
  });

  it("should match partial names", () => {
    const results = filterAgents(MOCK_AGENTS, "All", "supp");
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("IT Support");
  });
});
