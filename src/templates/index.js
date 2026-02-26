/**
 * Template Registry — Loads, searches, and manages governance templates.
 */

const { SECTOR_DEFINITIONS, validateTemplate } = require("./schema");

// Sector file loaders — each exports an array of template objects
const SECTOR_FILES = [
  "government", "education", "healthcare", "legal", "financial",
  "retail", "food", "realestate", "construction", "manufacturing",
  "technology", "professional-services", "nonprofit", "hospitality",
  "transportation", "automotive", "personal-care", "media",
  "agriculture", "energy", "care", "other-services", "solopreneur",
];

class TemplateRegistry {
  constructor() {
    this._templates = new Map();
    this._sectorIndex = new Map(); // sector -> template IDs
    this._loadAll();
  }

  _loadAll() {
    for (const sectorFile of SECTOR_FILES) {
      try {
        const templates = require(`./sectors/${sectorFile}`);
        for (const t of templates) {
          const { valid, errors } = validateTemplate(t);
          if (!valid) {
            console.warn(`Template ${t.id} validation failed:`, errors);
            continue;
          }
          this._templates.set(t.id, t);
          if (!this._sectorIndex.has(t.sector)) {
            this._sectorIndex.set(t.sector, []);
          }
          this._sectorIndex.get(t.sector).push(t.id);
        }
      } catch (err) {
        console.warn(`Failed to load sector file "${sectorFile}":`, err.message);
      }
    }
  }

  /** Get a single template by ID. */
  getTemplate(id) {
    return this._templates.get(id) || null;
  }

  /** List templates with optional filters. */
  listTemplates({ sector, size } = {}) {
    let results = [...this._templates.values()];
    if (sector) {
      results = results.filter((t) => t.sector === sector);
    }
    if (size) {
      results = results.filter((t) => t.size.includes(size));
    }
    return results;
  }

  /** Get all templates for a sector. */
  getTemplatesForSector(sector) {
    const ids = this._sectorIndex.get(sector) || [];
    return ids.map((id) => this._templates.get(id)).filter(Boolean);
  }

  /** List all sectors with metadata and template counts. */
  listSectors() {
    return Object.entries(SECTOR_DEFINITIONS)
      .map(([id, meta]) => ({
        id,
        ...meta,
        templateCount: (this._sectorIndex.get(id) || []).length,
      }))
      .sort((a, b) => a.order - b.order);
  }

  /** Search templates by keyword against discoveryKeywords, name, and description. */
  searchTemplates(query) {
    if (!query) return [];
    const q = query.toLowerCase().trim();
    const scored = [];

    for (const t of this._templates.values()) {
      let score = 0;

      // Exact keyword match in discoveryKeywords
      for (const kw of t.discoveryKeywords) {
        if (kw.toLowerCase() === q) { score += 100; break; }
        if (kw.toLowerCase().includes(q)) score += 10;
      }

      // Name match
      if (t.name.toLowerCase().includes(q)) score += 50;

      // Description match
      if (t.description && t.description.toLowerCase().includes(q)) score += 20;

      // Sector name match
      const sectorMeta = SECTOR_DEFINITIONS[t.sector];
      if (sectorMeta && sectorMeta.name.toLowerCase().includes(q)) score += 15;

      if (score > 0) {
        scored.push({ template: t, score });
      }
    }

    return scored
      .sort((a, b) => b.score - a.score)
      .map((s) => s.template);
  }

  /** Get total template count. */
  getTemplateCount() {
    return this._templates.size;
  }

  /** Get summary stats. */
  getSummary() {
    return {
      totalTemplates: this._templates.size,
      sectors: this.listSectors(),
    };
  }
}

module.exports = { TemplateRegistry };
