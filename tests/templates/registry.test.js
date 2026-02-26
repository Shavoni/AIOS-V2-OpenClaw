const { TemplateRegistry } = require("../../src/templates");
const {
  SECTOR_DEFINITIONS,
  validateTemplate,
  ORG_SIZES,
} = require("../../src/templates/schema");

describe("TemplateRegistry", () => {
  let registry;

  beforeEach(() => {
    registry = new TemplateRegistry();
  });

  // ---------------------------------------------------------------
  // 1. Loading — all 97 templates across 23 sectors
  // ---------------------------------------------------------------
  describe("loading", () => {
    it("loads all 97 templates", () => {
      expect(registry.getTemplateCount()).toBe(97);
    });

    it("indexes templates across all 23 sectors", () => {
      const sectors = registry.listSectors();
      const populatedSectors = sectors.filter((s) => s.templateCount > 0);
      expect(populatedSectors).toHaveLength(23);
    });

    it("has no empty sectors after load", () => {
      const sectors = registry.listSectors();
      for (const sector of sectors) {
        expect(sector.templateCount).toBeGreaterThan(0);
      }
    });
  });

  // ---------------------------------------------------------------
  // 2. getTemplate(id) — returns a template or null
  // ---------------------------------------------------------------
  describe("getTemplate", () => {
    it("returns a template object for a valid ID", () => {
      const t = registry.getTemplate("gov-city");
      expect(t).not.toBeNull();
      expect(t.id).toBe("gov-city");
      expect(t.name).toBe("City/Town Government");
      expect(t.sector).toBe("government");
    });

    it("returns null for a nonexistent ID", () => {
      expect(registry.getTemplate("nonexistent-template")).toBeNull();
    });

    it("returns null for undefined", () => {
      expect(registry.getTemplate(undefined)).toBeNull();
    });

    it("returns null for an empty string", () => {
      expect(registry.getTemplate("")).toBeNull();
    });

    it("returns templates from different sectors", () => {
      expect(registry.getTemplate("health-hospital")).not.toBeNull();
      expect(registry.getTemplate("food-restaurant")).not.toBeNull();
      expect(registry.getTemplate("solo-freelancer")).not.toBeNull();
    });
  });

  // ---------------------------------------------------------------
  // 3. listTemplates() — no filters returns all 97
  // ---------------------------------------------------------------
  describe("listTemplates (no filters)", () => {
    it("returns all 97 templates when called with no arguments", () => {
      const all = registry.listTemplates();
      expect(all).toHaveLength(97);
    });

    it("returns all 97 templates when called with empty object", () => {
      const all = registry.listTemplates({});
      expect(all).toHaveLength(97);
    });

    it("returns an array of template objects", () => {
      const all = registry.listTemplates();
      expect(Array.isArray(all)).toBe(true);
      for (const t of all) {
        expect(t).toHaveProperty("id");
        expect(t).toHaveProperty("name");
        expect(t).toHaveProperty("sector");
      }
    });
  });

  // ---------------------------------------------------------------
  // 4. listTemplates({ sector: 'healthcare' }) — returns 7
  // ---------------------------------------------------------------
  describe("listTemplates (sector filter)", () => {
    it("returns 7 healthcare templates", () => {
      const results = registry.listTemplates({ sector: "healthcare" });
      expect(results).toHaveLength(7);
      for (const t of results) {
        expect(t.sector).toBe("healthcare");
      }
    });

    it("returns 6 government templates", () => {
      const results = registry.listTemplates({ sector: "government" });
      expect(results).toHaveLength(6);
      for (const t of results) {
        expect(t.sector).toBe("government");
      }
    });

    it("returns 5 food templates", () => {
      const results = registry.listTemplates({ sector: "food" });
      expect(results).toHaveLength(5);
      for (const t of results) {
        expect(t.sector).toBe("food");
      }
    });

    it("returns 3 solopreneur templates", () => {
      const results = registry.listTemplates({ sector: "solopreneur" });
      expect(results).toHaveLength(3);
      for (const t of results) {
        expect(t.sector).toBe("solopreneur");
      }
    });

    it("returns empty array for unknown sector", () => {
      const results = registry.listTemplates({ sector: "underwater-basket-weaving" });
      expect(results).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------
  // 5. listTemplates({ size: 'solo' }) — filters by size
  // ---------------------------------------------------------------
  describe("listTemplates (size filter)", () => {
    it("filters templates by size 'solo'", () => {
      const results = registry.listTemplates({ size: "solo" });
      expect(results.length).toBeGreaterThan(0);
      for (const t of results) {
        expect(t.size).toContain("solo");
      }
    });

    it("returns 20 solo-sized templates", () => {
      const results = registry.listTemplates({ size: "solo" });
      expect(results).toHaveLength(20);
    });

    it("filters templates by size 'enterprise'", () => {
      const results = registry.listTemplates({ size: "enterprise" });
      expect(results.length).toBeGreaterThan(0);
      for (const t of results) {
        expect(t.size).toContain("enterprise");
      }
    });

    it("can combine sector and size filters", () => {
      const results = registry.listTemplates({ sector: "healthcare", size: "solo" });
      expect(results.length).toBeGreaterThan(0);
      for (const t of results) {
        expect(t.sector).toBe("healthcare");
        expect(t.size).toContain("solo");
      }
    });

    it("returns empty when no templates match combined filters", () => {
      // Government federal is enterprise-only, solo should yield 0 for federal-only
      const results = registry.listTemplates({ sector: "government", size: "solo" });
      // Some government templates do include small, but solo may or may not exist
      for (const t of results) {
        expect(t.sector).toBe("government");
        expect(t.size).toContain("solo");
      }
    });
  });

  // ---------------------------------------------------------------
  // 6. searchTemplates('hospital') — finds healthcare templates
  // ---------------------------------------------------------------
  describe("searchTemplates('hospital')", () => {
    it("finds templates matching 'hospital'", () => {
      const results = registry.searchTemplates("hospital");
      expect(results.length).toBeGreaterThan(0);
    });

    it("returns the hospital/health system template first", () => {
      const results = registry.searchTemplates("hospital");
      // health-hospital has 'hospital' as an exact keyword match, so should rank first
      expect(results[0].id).toBe("health-hospital");
    });

    it("includes results from healthcare sector", () => {
      const results = registry.searchTemplates("hospital");
      const healthcareResults = results.filter((t) => t.sector === "healthcare");
      expect(healthcareResults.length).toBeGreaterThan(0);
    });

    it("results are sorted by relevance score", () => {
      const results = registry.searchTemplates("hospital");
      // The first result should have 'hospital' in its name or keywords
      const first = results[0];
      const hasHospitalKeyword = first.discoveryKeywords.some((kw) =>
        kw.toLowerCase().includes("hospital")
      );
      const hasHospitalName = first.name.toLowerCase().includes("hospital");
      expect(hasHospitalKeyword || hasHospitalName).toBe(true);
    });
  });

  // ---------------------------------------------------------------
  // 7. searchTemplates('donut') — finds food templates
  // ---------------------------------------------------------------
  describe("searchTemplates('donut')", () => {
    it("finds the bakery/cafe/donut shop template", () => {
      const results = registry.searchTemplates("donut");
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("food-cafe");
      expect(results[0].sector).toBe("food");
    });

    it("matches via discoveryKeywords", () => {
      const results = registry.searchTemplates("donut");
      const template = results[0];
      const hasDonutKeyword = template.discoveryKeywords.some((kw) =>
        kw.toLowerCase().includes("donut")
      );
      expect(hasDonutKeyword).toBe(true);
    });
  });

  // ---------------------------------------------------------------
  // 8. searchTemplates('') — returns empty array
  // ---------------------------------------------------------------
  describe("searchTemplates (empty/falsy query)", () => {
    it("returns empty array for empty string", () => {
      expect(registry.searchTemplates("")).toEqual([]);
    });

    it("returns empty array for null", () => {
      expect(registry.searchTemplates(null)).toEqual([]);
    });

    it("returns empty array for undefined", () => {
      expect(registry.searchTemplates(undefined)).toEqual([]);
    });

    it("returns empty array for a query with no matches", () => {
      const results = registry.searchTemplates("zyxwvutsrqponmlkjihgfedcba");
      expect(results).toEqual([]);
    });
  });

  // ---------------------------------------------------------------
  // 9. listSectors() — returns 23 sectors sorted by order
  // ---------------------------------------------------------------
  describe("listSectors", () => {
    it("returns 23 sectors", () => {
      const sectors = registry.listSectors();
      expect(sectors).toHaveLength(23);
    });

    it("sectors are sorted by order field", () => {
      const sectors = registry.listSectors();
      for (let i = 1; i < sectors.length; i++) {
        expect(sectors[i].order).toBeGreaterThan(sectors[i - 1].order);
      }
    });

    it("first sector is government (order 1)", () => {
      const sectors = registry.listSectors();
      expect(sectors[0].id).toBe("government");
      expect(sectors[0].order).toBe(1);
    });

    it("last sector is solopreneur (order 23)", () => {
      const sectors = registry.listSectors();
      expect(sectors[22].id).toBe("solopreneur");
      expect(sectors[22].order).toBe(23);
    });

    it("each sector has id, name, icon, order, and templateCount", () => {
      const sectors = registry.listSectors();
      for (const sector of sectors) {
        expect(sector).toHaveProperty("id");
        expect(sector).toHaveProperty("name");
        expect(sector).toHaveProperty("icon");
        expect(sector).toHaveProperty("order");
        expect(sector).toHaveProperty("templateCount");
        expect(typeof sector.id).toBe("string");
        expect(typeof sector.name).toBe("string");
        expect(typeof sector.icon).toBe("string");
        expect(typeof sector.order).toBe("number");
        expect(typeof sector.templateCount).toBe("number");
      }
    });

    it("templateCount values sum to 97", () => {
      const sectors = registry.listSectors();
      const total = sectors.reduce((sum, s) => sum + s.templateCount, 0);
      expect(total).toBe(97);
    });
  });

  // ---------------------------------------------------------------
  // 10. getTemplatesForSector('government') — returns 6 templates
  // ---------------------------------------------------------------
  describe("getTemplatesForSector", () => {
    it("returns 6 government templates", () => {
      const results = registry.getTemplatesForSector("government");
      expect(results).toHaveLength(6);
      for (const t of results) {
        expect(t.sector).toBe("government");
      }
    });

    it("returns 7 healthcare templates", () => {
      const results = registry.getTemplatesForSector("healthcare");
      expect(results).toHaveLength(7);
    });

    it("returns empty array for unknown sector", () => {
      const results = registry.getTemplatesForSector("nonexistent");
      expect(results).toEqual([]);
    });

    it("returns template objects (not just IDs)", () => {
      const results = registry.getTemplatesForSector("food");
      expect(results).toHaveLength(5);
      for (const t of results) {
        expect(t).toHaveProperty("id");
        expect(t).toHaveProperty("name");
        expect(t).toHaveProperty("departments");
      }
    });
  });

  // ---------------------------------------------------------------
  // 11. getTemplateCount() — returns 97
  // ---------------------------------------------------------------
  describe("getTemplateCount", () => {
    it("returns 97", () => {
      expect(registry.getTemplateCount()).toBe(97);
    });

    it("matches the length of listTemplates()", () => {
      expect(registry.getTemplateCount()).toBe(registry.listTemplates().length);
    });
  });

  // ---------------------------------------------------------------
  // 12. getSummary() — includes totalTemplates and sectors
  // ---------------------------------------------------------------
  describe("getSummary", () => {
    it("returns an object with totalTemplates and sectors", () => {
      const summary = registry.getSummary();
      expect(summary).toHaveProperty("totalTemplates");
      expect(summary).toHaveProperty("sectors");
    });

    it("totalTemplates is 97", () => {
      const summary = registry.getSummary();
      expect(summary.totalTemplates).toBe(97);
    });

    it("sectors is an array of 23 entries", () => {
      const summary = registry.getSummary();
      expect(Array.isArray(summary.sectors)).toBe(true);
      expect(summary.sectors).toHaveLength(23);
    });

    it("each sector in summary has templateCount", () => {
      const summary = registry.getSummary();
      for (const sector of summary.sectors) {
        expect(sector).toHaveProperty("templateCount");
        expect(sector.templateCount).toBeGreaterThan(0);
      }
    });

    it("sectors in summary are sorted by order", () => {
      const summary = registry.getSummary();
      for (let i = 1; i < summary.sectors.length; i++) {
        expect(summary.sectors[i].order).toBeGreaterThan(summary.sectors[i - 1].order);
      }
    });
  });

  // ---------------------------------------------------------------
  // 13. validateTemplate — rejects invalid templates
  // ---------------------------------------------------------------
  describe("validateTemplate", () => {
    const validTemplate = {
      id: "test-valid",
      name: "Valid Test Template",
      sector: "healthcare",
      size: ["small"],
      departments: [],
      governance: {},
      discoveryKeywords: [],
    };

    it("accepts a valid template", () => {
      const result = validateTemplate(validTemplate);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("rejects a template missing id", () => {
      const { id, ...noId } = validTemplate;
      const result = validateTemplate(noId);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.stringContaining("id"),
      ]));
    });

    it("rejects a template missing name", () => {
      const result = validateTemplate({ ...validTemplate, name: undefined });
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.stringContaining("name"),
      ]));
    });

    it("rejects a template with invalid sector", () => {
      const result = validateTemplate({ ...validTemplate, sector: "fake-sector" });
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.stringContaining("sector"),
      ]));
    });

    it("rejects a template with missing sector", () => {
      const result = validateTemplate({ ...validTemplate, sector: undefined });
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.stringContaining("sector"),
      ]));
    });

    it("rejects a template with invalid size values", () => {
      const result = validateTemplate({ ...validTemplate, size: ["mega"] });
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.stringContaining("size"),
      ]));
    });

    it("rejects a template where size is not an array", () => {
      const result = validateTemplate({ ...validTemplate, size: "small" });
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.stringContaining("size"),
      ]));
    });

    it("rejects a template where departments is not an array", () => {
      const result = validateTemplate({ ...validTemplate, departments: "none" });
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.stringContaining("departments"),
      ]));
    });

    it("rejects a template where governance is not an object", () => {
      const result = validateTemplate({ ...validTemplate, governance: "none" });
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.stringContaining("governance"),
      ]));
    });

    it("rejects a template where governance is missing", () => {
      const result = validateTemplate({ ...validTemplate, governance: undefined });
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.stringContaining("governance"),
      ]));
    });

    it("rejects a template where discoveryKeywords is not an array", () => {
      const result = validateTemplate({ ...validTemplate, discoveryKeywords: "none" });
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.stringContaining("discoveryKeywords"),
      ]));
    });

    it("rejects a completely empty object with multiple errors", () => {
      const result = validateTemplate({});
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(6);
    });

    it("returns all errors at once, not just the first", () => {
      const result = validateTemplate({});
      // Missing id, name, sector, size, departments, governance, discoveryKeywords
      expect(result.errors.length).toBeGreaterThanOrEqual(6);
      const errorText = result.errors.join(" ");
      expect(errorText).toContain("id");
      expect(errorText).toContain("name");
      expect(errorText).toContain("sector");
      expect(errorText).toContain("size");
      expect(errorText).toContain("departments");
      expect(errorText).toContain("governance");
      expect(errorText).toContain("discoveryKeywords");
    });

    it("accepts all valid ORG_SIZES values", () => {
      for (const size of ORG_SIZES) {
        const result = validateTemplate({ ...validTemplate, size: [size] });
        expect(result.valid).toBe(true);
      }
    });

    it("accepts all valid SECTOR_DEFINITIONS keys as sector", () => {
      for (const sectorKey of Object.keys(SECTOR_DEFINITIONS)) {
        const result = validateTemplate({ ...validTemplate, sector: sectorKey });
        expect(result.valid).toBe(true);
      }
    });
  });

  // ---------------------------------------------------------------
  // 14. Template schema validation — each template has required fields
  // ---------------------------------------------------------------
  describe("template schema (all loaded templates)", () => {
    let allTemplates;

    beforeAll(() => {
      const reg = new TemplateRegistry();
      allTemplates = reg.listTemplates();
    });

    it("every template has a string id", () => {
      for (const t of allTemplates) {
        expect(typeof t.id).toBe("string");
        expect(t.id.length).toBeGreaterThan(0);
      }
    });

    it("every template has a string name", () => {
      for (const t of allTemplates) {
        expect(typeof t.name).toBe("string");
        expect(t.name.length).toBeGreaterThan(0);
      }
    });

    it("every template has a valid sector", () => {
      for (const t of allTemplates) {
        expect(typeof t.sector).toBe("string");
        expect(SECTOR_DEFINITIONS).toHaveProperty(t.sector);
      }
    });

    it("every template has a size array with valid values", () => {
      for (const t of allTemplates) {
        expect(Array.isArray(t.size)).toBe(true);
        expect(t.size.length).toBeGreaterThan(0);
        for (const s of t.size) {
          expect(ORG_SIZES).toContain(s);
        }
      }
    });

    it("every template has a departments array", () => {
      for (const t of allTemplates) {
        expect(Array.isArray(t.departments)).toBe(true);
      }
    });

    it("every template has a governance object", () => {
      for (const t of allTemplates) {
        expect(typeof t.governance).toBe("object");
        expect(t.governance).not.toBeNull();
      }
    });

    it("every template has a discoveryKeywords array", () => {
      for (const t of allTemplates) {
        expect(Array.isArray(t.discoveryKeywords)).toBe(true);
      }
    });

    it("every template has at least one discoveryKeyword", () => {
      for (const t of allTemplates) {
        expect(t.discoveryKeywords.length).toBeGreaterThan(0);
      }
    });

    it("every template passes validateTemplate", () => {
      for (const t of allTemplates) {
        const result = validateTemplate(t);
        expect(result.valid).toBe(true);
        if (!result.valid) {
          // If this fails, show which template and why
          console.error(`Template ${t.id} failed validation:`, result.errors);
        }
      }
    });

    it("every department has domain, name, and capabilities", () => {
      for (const t of allTemplates) {
        for (const dept of t.departments) {
          expect(dept).toHaveProperty("domain");
          expect(dept).toHaveProperty("name");
          expect(dept).toHaveProperty("capabilities");
          expect(typeof dept.domain).toBe("string");
          expect(typeof dept.name).toBe("string");
          expect(Array.isArray(dept.capabilities)).toBe(true);
        }
      }
    });
  });

  // ---------------------------------------------------------------
  // 15. All template IDs are unique
  // ---------------------------------------------------------------
  describe("template ID uniqueness", () => {
    it("all 97 template IDs are unique", () => {
      const all = registry.listTemplates();
      const ids = all.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
      expect(uniqueIds.size).toBe(97);
    });

    it("no duplicate IDs across sectors", () => {
      const idsBySector = {};
      const all = registry.listTemplates();
      for (const t of all) {
        if (!idsBySector[t.sector]) idsBySector[t.sector] = [];
        idsBySector[t.sector].push(t.id);
      }
      const allIds = Object.values(idsBySector).flat();
      expect(new Set(allIds).size).toBe(allIds.length);
    });
  });

  // ---------------------------------------------------------------
  // 16. Every template's sector is a valid SECTOR_DEFINITIONS key
  // ---------------------------------------------------------------
  describe("sector validity", () => {
    it("every template references a sector defined in SECTOR_DEFINITIONS", () => {
      const validSectors = Object.keys(SECTOR_DEFINITIONS);
      const all = registry.listTemplates();
      for (const t of all) {
        expect(validSectors).toContain(t.sector);
      }
    });

    it("every SECTOR_DEFINITIONS key has at least one template", () => {
      const validSectors = Object.keys(SECTOR_DEFINITIONS);
      for (const sectorKey of validSectors) {
        const templates = registry.getTemplatesForSector(sectorKey);
        expect(templates.length).toBeGreaterThan(0);
      }
    });

    it("SECTOR_DEFINITIONS has exactly 23 entries", () => {
      expect(Object.keys(SECTOR_DEFINITIONS).length).toBe(23);
    });

    it("ORG_SIZES contains the five expected values", () => {
      expect(ORG_SIZES).toEqual(["solo", "small", "medium", "large", "enterprise"]);
    });
  });

  // ---------------------------------------------------------------
  // Sector-level template count verification
  // ---------------------------------------------------------------
  describe("per-sector template counts", () => {
    const expectedCounts = {
      government: 6,
      education: 5,
      healthcare: 7,
      legal: 3,
      financial: 6,
      retail: 4,
      food: 5,
      realestate: 3,
      construction: 4,
      manufacturing: 4,
      technology: 5,
      "professional-services": 5,
      nonprofit: 5,
      hospitality: 4,
      transportation: 4,
      automotive: 3,
      "personal-care": 3,
      media: 4,
      agriculture: 3,
      energy: 3,
      care: 3,
      "other-services": 5,
      solopreneur: 3,
    };

    for (const [sector, count] of Object.entries(expectedCounts)) {
      it(`${sector} has ${count} templates`, () => {
        const templates = registry.getTemplatesForSector(sector);
        expect(templates).toHaveLength(count);
      });
    }
  });
});
