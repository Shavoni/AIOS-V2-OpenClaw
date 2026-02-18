/**
 * LLM-Enhanced Discovery — uses the LLM router for intelligent extraction.
 * Port of V1 Python LLMDiscoveryEngine.
 */

const { load: cheerioLoad } = require("cheerio");

class LLMDiscoveryEngine {
  /**
   * @param {object} router - ModelRouter instance for LLM calls
   */
  constructor(router) {
    this.router = router;
  }

  /**
   * Enhance a discovery result with LLM analysis.
   * @param {object} discoveryResult - Raw discovery result from DiscoveryEngine
   * @param {object} pagesContent - Map of URL → HTML content
   * @returns {object} Enhanced result with LLM insights
   */
  async enhance(discoveryResult, pagesContent) {
    const enhanced = {
      ...discoveryResult,
      llmEnhanced: true,
      organizationalInsights: {},
      templateRecommendations: {},
    };

    if (!this.router) {
      enhanced.llmEnhanced = false;
      return enhanced;
    }

    const combinedContent = this._prepareContentForLLM(pagesContent);

    // 1. Extract organizational structure via LLM
    try {
      const orgResult = await this._extractOrganizationStructure(combinedContent);
      if (orgResult) {
        this._applyOrganizationExtraction(enhanced, orgResult);
      }
    } catch { /* non-critical */ }

    // 2. Generate template recommendations
    try {
      const recs = await this._generateTemplateRecommendations(enhanced);
      if (recs) {
        enhanced.templateRecommendations = recs;
      }
    } catch { /* non-critical */ }

    // 3. Extract organizational insights
    try {
      const insights = await this._extractOrganizationalInsights(enhanced);
      if (insights) {
        enhanced.organizationalInsights = insights;
      }
    } catch { /* non-critical */ }

    return enhanced;
  }

  _prepareContentForLLM(pagesContent, maxChars = 50000) {
    const priorityKeywords = ["government", "department", "director", "mayor", "leadership"];

    const scored = Object.entries(pagesContent).map(([url, html]) => {
      let score = 0;
      const urlLower = url.toLowerCase();
      for (const kw of priorityKeywords) {
        if (urlLower.includes(kw)) score += 10;
      }

      const cleaned = this._cleanHtml(html);
      for (const kw of priorityKeywords) {
        if (cleaned.toLowerCase().includes(kw)) score += 5;
      }

      return { url, content: cleaned, score };
    });

    scored.sort((a, b) => b.score - a.score);

    const parts = [];
    let chars = 0;
    for (const { url, content } of scored) {
      if (chars + content.length > maxChars) {
        const remaining = maxChars - chars;
        if (remaining > 500) {
          parts.push(`=== Page: ${url} ===\n${content.slice(0, remaining)}\n`);
        }
        break;
      }
      parts.push(`=== Page: ${url} ===\n${content}\n`);
      chars += content.length;
    }

    return parts.join("\n");
  }

  _cleanHtml(html) {
    try {
      const $ = cheerioLoad(html);
      $("script, style, nav, footer, header").remove();
      const text = $.text();
      return text.split("\n").map((l) => l.trim()).filter(Boolean).join("\n");
    } catch {
      return "";
    }
  }

  async _extractOrganizationStructure(content) {
    const prompt = `Extract the organizational structure from this municipal government website content.

CONTENT:
${content.slice(0, 30000)}

Extract and return as JSON:
{
  "municipality": { "name": "City name", "state": "State abbreviation" },
  "executive": { "name": "Mayor/Manager name", "title": "Official title", "office": "Office name" },
  "chief_officers": [{ "name": "Name", "title": "Title", "office": "Office" }],
  "departments": [
    {
      "name": "Department name",
      "director": "Director name if found",
      "director_title": "Director title if found",
      "category": "suggested category: hr, finance, health, safety, etc.",
      "services": ["list of services mentioned"]
    }
  ],
  "organizational_notes": "Any relevant observations"
}

Be thorough but only include explicitly stated or strongly implied information.`;

    const messages = [
      { role: "system", content: "You extract organizational data from website content. Return only valid JSON." },
      { role: "user", content: prompt },
    ];

    const result = await this.router.route(messages, { maxTokens: 4000 });
    return this._parseJsonResponse(result.text);
  }

  async _generateTemplateRecommendations(result) {
    const deptSummary = (result.departments || [])
      .map((d) => `- ${d.name}: ${d.description || "No description"} (suggested: ${d.suggestedTemplate || "unknown"})`)
      .join("\n");

    const prompt = `Recommend AI assistant templates for these municipal departments.

MUNICIPALITY: ${result.municipality?.name || "Unknown"}

DEPARTMENTS:
${deptSummary}

AVAILABLE TEMPLATES:
- router-concierge: Central routing for all requests
- executive-strategy: Strategic leadership support
- public-health: Health department support
- building-housing: Permits and code enforcement
- public-safety: Police, fire, EMS support
- parks-recreation: Parks and community programs
- finance-department: Budget and procurement
- human-resources: HR policies and benefits
- information-technology: IT support
- legal-compliance: Legal research support
- community-development: Grants and programs
- communications: Media and public relations
- public-works: Utilities, streets, water

For each department, recommend the best template. Return as JSON:
{
  "recommendations": {
    "department_name": [{ "template_id": "id", "confidence": 0.0-1.0, "reason": "why" }]
  },
  "additional_agents_recommended": [{ "template_id": "id", "reason": "why" }]
}`;

    const messages = [
      { role: "system", content: "You are an AI deployment advisor. Return only valid JSON." },
      { role: "user", content: prompt },
    ];

    const res = await this.router.route(messages, { maxTokens: 4000 });
    return this._parseJsonResponse(res.text);
  }

  async _extractOrganizationalInsights(result) {
    const prompt = `Analyze this municipal organization for AI deployment readiness.

MUNICIPALITY: ${result.municipality?.name || "Unknown"}
EXECUTIVE: ${result.executive?.name || "Unknown"}
DEPARTMENTS: ${(result.departments || []).length}
DATA PORTALS: ${(result.dataPortals || []).length}

Return as JSON:
{
  "governance_structure": "Description of governance structure",
  "digital_maturity": "low/medium/high",
  "ai_readiness_score": 1-10,
  "recommended_pilot_departments": [{ "department": "name", "reason": "why" }],
  "quick_wins": ["Easy wins for initial deployment"]
}`;

    const messages = [
      { role: "system", content: "You are a municipal AI strategy advisor. Return only valid JSON." },
      { role: "user", content: prompt },
    ];

    const res = await this.router.route(messages, { maxTokens: 3000 });
    return this._parseJsonResponse(res.text);
  }

  _applyOrganizationExtraction(enhanced, data) {
    // Update municipality
    if (data.municipality) {
      if (enhanced.municipality && data.municipality.name) {
        enhanced.municipality.name = data.municipality.name;
      }
      if (enhanced.municipality && data.municipality.state) {
        enhanced.municipality.state = data.municipality.state;
      }
    }

    // Update executive
    if (data.executive && !enhanced.executive) {
      enhanced.executive = {
        name: data.executive.name || "",
        title: data.executive.title || "",
        office: data.executive.office || "",
      };
    }

    // Add new departments
    const existingNames = new Set((enhanced.departments || []).map((d) => d.name.toLowerCase()));

    for (const dept of data.departments || []) {
      if (dept.name && !existingNames.has(dept.name.toLowerCase())) {
        const deptId = dept.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30).replace(/^-|-$/g, "");
        enhanced.departments.push({
          id: deptId,
          name: dept.name,
          director: dept.director || null,
          directorTitle: dept.director_title || null,
          url: null,
          description: null,
          suggestedTemplate: dept.category || null,
          keywordsMatched: [],
          contact: { email: null, phone: null, address: null },
        });
        existingNames.add(dept.name.toLowerCase());
      }
    }
  }

  _parseJsonResponse(text) {
    if (!text) return null;

    // Direct parse
    try { return JSON.parse(text); } catch { /* continue */ }

    // From markdown code block
    const blockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (blockMatch) {
      try { return JSON.parse(blockMatch[1]); } catch { /* continue */ }
    }

    // Find JSON object in text
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try { return JSON.parse(objMatch[0]); } catch { /* continue */ }
    }

    return null;
  }
}

module.exports = { LLMDiscoveryEngine };
