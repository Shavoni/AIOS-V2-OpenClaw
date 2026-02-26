const DOMAIN_PATTERNS = {
  Comms: {
    patterns: [/\b(email|slack|message|send|reply|draft.*message|compose)\b/i],
    keywords: ["email", "slack", "message", "send", "reply", "compose", "forward", "cc", "bcc"],
  },
  Legal: {
    patterns: [/\b(contract|agreement|terms|legal|clause|liability|nda|compliance)\b/i],
    keywords: ["contract", "agreement", "legal", "terms", "clause", "liability", "nda", "compliance", "regulation"],
  },
  HR: {
    patterns: [/\b(employee|hire|termina|salary|performance.review|onboard)\b/i],
    keywords: ["employee", "hire", "fire", "salary", "performance", "onboard", "offboard", "benefits", "pto"],
  },
  Finance: {
    patterns: [/\b(invoice|payment|budget|expense|revenue|financial|accounting)\b/i],
    keywords: ["invoice", "payment", "budget", "expense", "revenue", "financial", "accounting", "transaction"],
  },
  DevOps: {
    patterns: [/\b(deploy|server|docker|ci.?cd|pipeline|infrastructure|kubernetes)\b/i],
    keywords: ["deploy", "server", "docker", "cicd", "pipeline", "infrastructure", "kubernetes", "aws"],
  },
  General: {
    patterns: [],
    keywords: [],
  },
};

class IntentClassifier {
  /**
   * @param {import('./domain-registry').DomainRegistry} [registry] - Optional domain registry for extended domains
   */
  constructor(registry) {
    this._registry = registry || null;
  }

  /** Get the active domain patterns — from registry if available, else hardcoded. */
  _getDomains() {
    if (this._registry) {
      const domains = {};
      for (const [id, config] of this._registry.listDomains()) {
        domains[id] = config;
      }
      return domains;
    }
    return DOMAIN_PATTERNS;
  }

  classify(text) {
    const lower = text.toLowerCase();
    let bestDomain = "General";
    let bestScore = 0;
    const domains = this._getDomains();

    for (const [domain, config] of Object.entries(domains)) {
      if (domain === "General") continue;
      let score = 0;

      for (const pattern of config.patterns) {
        if (pattern.test(lower)) score += 0.4;
      }
      for (const kw of (config.keywords || [])) {
        if (lower.includes(kw)) score += 0.15;
      }

      if (score > bestScore) {
        bestScore = score;
        bestDomain = domain;
      }
    }

    if (bestScore < 0.15) bestDomain = "General";

    return {
      domain: bestDomain,
      confidence: Math.min(bestScore, 1),
      allScores: this._allScores(lower),
    };
  }

  _allScores(lower) {
    const scores = {};
    const domains = this._getDomains();
    for (const [domain, config] of Object.entries(domains)) {
      let score = 0;
      for (const p of config.patterns) { if (p.test(lower)) score += 0.4; }
      for (const kw of (config.keywords || [])) { if (lower.includes(kw)) score += 0.15; }
      scores[domain] = Math.min(score, 1);
    }
    return scores;
  }
}

module.exports = { IntentClassifier, DOMAIN_PATTERNS };
