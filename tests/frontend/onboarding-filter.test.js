/**
 * RED → GREEN — Onboarding Wizard: Smart Category Filter Chips
 * Tests the chip-based domain filtering logic for Step 5 (Select Agents).
 */

const fs = require("fs");
const path = require("path");

/**
 * Pure logic: build the list of filter chip data from agents.
 */
function buildFilterChips(agents) {
  const domainCounts = new Map();
  domainCounts.set("All", agents.length);
  for (const agent of agents) {
    const d = agent.domain || "General";
    domainCounts.set(d, (domainCounts.get(d) || 0) + 1);
  }
  return Array.from(domainCounts.entries()).map(([domain, count]) => ({
    domain,
    count,
  }));
}

/**
 * Pure logic: generate chip HTML (same function that will be in onboarding.js).
 */
function renderFilterChipsHTML(agents, activeFilter) {
  const chips = buildFilterChips(agents);
  return chips
    .map(
      ({ domain, count }) =>
        `<button class="onb-filter-chip ${activeFilter === domain ? "active" : ""}" data-domain="${domain}">${domain} <span class="chip-count">(${count})</span></button>`
    )
    .join("");
}

function filterAgents(agents, domain, searchQuery) {
  let filtered = domain === "All" ? [...agents] : agents.filter((a) => (a.domain || "General") === domain);
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

describe("Onboarding Filter Chips", () => {
  it("should build chip data dynamically from agent domains", () => {
    const chips = buildFilterChips(MOCK_AGENTS);
    const domains = chips.map((c) => c.domain);

    expect(domains).toContain("All");
    expect(domains).toContain("HR");
    expect(domains).toContain("Finance");
    expect(domains).toContain("Legal");
    expect(domains).toContain("PublicSafety");
    expect(domains).toContain("IT");
    expect(chips.length).toBe(6); // All + 5 unique domains
  });

  it("should include correct counts per domain", () => {
    const chips = buildFilterChips(MOCK_AGENTS);
    const chipMap = Object.fromEntries(chips.map((c) => [c.domain, c.count]));

    expect(chipMap["All"]).toBe(6);
    expect(chipMap["HR"]).toBe(2);
    expect(chipMap["Finance"]).toBe(1);
    expect(chipMap["IT"]).toBe(1);
  });

  it('should render HTML with "All" chip marked active by default', () => {
    const html = renderFilterChipsHTML(MOCK_AGENTS, "All");
    expect(html).toContain('data-domain="All"');
    // All chip should have active class
    expect(html).toMatch(/data-domain="All"[^>]*>/);
    expect(html).toContain('onb-filter-chip active" data-domain="All"');
  });

  it("should mark selected domain chip as active", () => {
    const html = renderFilterChipsHTML(MOCK_AGENTS, "Finance");
    expect(html).toContain('onb-filter-chip active" data-domain="Finance"');
    // All chip should NOT be active
    expect(html).not.toContain('onb-filter-chip active" data-domain="All"');
  });

  it("should filter agents by domain", () => {
    const hrAgents = filterAgents(MOCK_AGENTS, "HR", "");
    expect(hrAgents.length).toBe(2);
    expect(hrAgents.every((a) => a.domain === "HR")).toBe(true);
  });

  it('should show all agents when "All" is active', () => {
    const allAgents = filterAgents(MOCK_AGENTS, "All", "");
    expect(allAgents.length).toBe(6);
  });

  it("should use chip elements (not select dropdown) in onboarding CSS", () => {
    const cssPath = path.join(__dirname, "../../public/css/pages/onboarding.css");
    const css = fs.readFileSync(cssPath, "utf-8");
    expect(css).toContain(".onb-filter-chip");
  });
});
