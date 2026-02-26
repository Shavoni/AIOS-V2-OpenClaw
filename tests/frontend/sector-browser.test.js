/**
 * Tests for Sector Browser & Template Picker constants and logic.
 * Validates SECTOR_EMOJI_MAP coverage and sector search filtering.
 */

const { SECTOR_DEFINITIONS } = require("../../src/templates/schema");

// Reproduce the SECTOR_EMOJI_MAP from onboarding.js for validation
const SECTOR_EMOJI_MAP = {
  'building-columns':    '&#127963;',
  'graduation-cap':      '&#127891;',
  'heart-pulse':         '&#10084;&#65039;',
  'scale-balanced':      '&#9878;&#65039;',
  'landmark':            '&#127974;',
  'store':               '&#128722;',
  'utensils':            '&#127860;',
  'house':               '&#127968;',
  'hard-hat':            '&#128679;',
  'industry':            '&#127981;',
  'microchip':           '&#128187;',
  'briefcase':           '&#128188;',
  'hand-holding-heart':  '&#129309;',
  'hotel':               '&#127976;',
  'truck':               '&#128666;',
  'car':                 '&#128663;',
  'spa':                 '&#128134;',
  'film':                '&#127910;',
  'tractor':             '&#128668;',
  'bolt':                '&#9889;',
  'people-roof':         '&#128106;',
  'wrench':              '&#128295;',
  'user':                '&#128100;',
};

/** Simulate sector search filtering as in _renderSectorStep() */
function filterSectors(sectors, query) {
  if (!query) return sectors;
  const q = query.toLowerCase();
  return sectors.filter(s => s.name.toLowerCase().includes(q));
}

// Build mock sector list from SECTOR_DEFINITIONS (mirrors TemplateRegistry.listSectors())
const MOCK_SECTORS = Object.entries(SECTOR_DEFINITIONS).map(([id, meta]) => ({
  id,
  ...meta,
  templateCount: 4,
})).sort((a, b) => a.order - b.order);

describe("SECTOR_EMOJI_MAP", () => {
  it("covers all 23 icon names from SECTOR_DEFINITIONS", () => {
    const allIcons = Object.values(SECTOR_DEFINITIONS).map(s => s.icon);
    expect(allIcons.length).toBe(23);

    for (const icon of allIcons) {
      expect(SECTOR_EMOJI_MAP).toHaveProperty(icon);
      expect(SECTOR_EMOJI_MAP[icon]).toBeTruthy();
    }
  });

  it("has no extra icons beyond SECTOR_DEFINITIONS", () => {
    const definedIcons = new Set(Object.values(SECTOR_DEFINITIONS).map(s => s.icon));
    const mapIcons = Object.keys(SECTOR_EMOJI_MAP);

    for (const icon of mapIcons) {
      expect(definedIcons.has(icon)).toBe(true);
    }
  });

  it("all emoji values are valid HTML entities", () => {
    for (const [icon, emoji] of Object.entries(SECTOR_EMOJI_MAP)) {
      expect(emoji).toMatch(/&#\d+;/);
    }
  });
});

describe("Sector Search Filtering", () => {
  it("returns all sectors when query is empty", () => {
    const result = filterSectors(MOCK_SECTORS, "");
    expect(result.length).toBe(23);
  });

  it("returns all sectors when query is null", () => {
    const result = filterSectors(MOCK_SECTORS, null);
    expect(result.length).toBe(23);
  });

  it("filters by partial name (case-insensitive)", () => {
    const result = filterSectors(MOCK_SECTORS, "health");
    expect(result.length).toBeGreaterThan(0);
    expect(result.some(s => s.id === "healthcare")).toBe(true);
  });

  it("finds 'Technology' sector", () => {
    const result = filterSectors(MOCK_SECTORS, "tech");
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].id).toBe("technology");
  });

  it("finds 'Food & Beverage' sector", () => {
    const result = filterSectors(MOCK_SECTORS, "food");
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].id).toBe("food");
  });

  it("returns empty when no match", () => {
    const result = filterSectors(MOCK_SECTORS, "xyznonexistent");
    expect(result.length).toBe(0);
  });

  it("is case-insensitive", () => {
    const lower = filterSectors(MOCK_SECTORS, "real estate");
    const upper = filterSectors(MOCK_SECTORS, "REAL ESTATE");
    expect(lower.length).toBe(upper.length);
    expect(lower.length).toBeGreaterThan(0);
  });

  it("matches partial words", () => {
    const result = filterSectors(MOCK_SECTORS, "auto");
    expect(result.some(s => s.id === "automotive")).toBe(true);
  });
});

describe("Sector Search — multiple results", () => {
  it("'care' matches both Healthcare and Childcare", () => {
    const result = filterSectors(MOCK_SECTORS, "care");
    const ids = result.map(s => s.id);
    expect(ids).toContain("healthcare");
    expect(ids).toContain("personal-care");
    expect(ids).toContain("care");
  });

  it("'service' matches Professional Services and Other Services", () => {
    const result = filterSectors(MOCK_SECTORS, "service");
    const ids = result.map(s => s.id);
    expect(ids).toContain("professional-services");
    expect(ids).toContain("other-services");
    expect(ids).toContain("financial"); // "Financial Services"
  });
});

describe("Wizard setSector Department Mapping", () => {
  it("handles string departments", () => {
    const dept = "HR";
    const name = typeof dept === 'string' ? dept : dept.name;
    expect(name).toBe("HR");
  });

  it("handles object departments", () => {
    const dept = { domain: "Healthcare", name: "Clinical Operations", capabilities: ["scheduling", "records"] };
    const name = typeof dept === 'string' ? dept : dept.name;
    const domain = (typeof dept === 'object' && dept.domain) ? dept.domain : "General";
    const caps = (typeof dept === 'object' && Array.isArray(dept.capabilities)) ? dept.capabilities : [];

    expect(name).toBe("Clinical Operations");
    expect(domain).toBe("Healthcare");
    expect(caps).toEqual(["scheduling", "records"]);
  });

  it("handles object department without domain", () => {
    const dept = { name: "IT Support" };
    const name = typeof dept === 'string' ? dept : dept.name;
    const domain = (typeof dept === 'object' && dept.domain) ? dept.domain : "General";
    const caps = (typeof dept === 'object' && Array.isArray(dept.capabilities)) ? dept.capabilities : [];

    expect(name).toBe("IT Support");
    expect(domain).toBe("General");
    expect(caps).toEqual([]);
  });
});
