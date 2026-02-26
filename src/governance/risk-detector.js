const RISK_PATTERNS = {
  PII: [
    /\b\d{3}-\d{2}-\d{4}\b/,
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
    /\b\d{3}[- ]?\d{3}[- ]?\d{4}\b/,
    /\b(ssn|social.security|date.of.birth|passport.number)\b/i,
  ],
  LEGAL_CONTRACT: [
    /\b(hereby|whereas|party of the first|binding agreement|shall be liable)\b/i,
    /\b(sign|execute).*(contract|agreement|nda)\b/i,
  ],
  PUBLIC_STATEMENT: [
    /\b(press.release|public.statement|announce|publish|post.publicly|social.media.post)\b/i,
    /\b(tweet|linkedin.post|blog.post|newsletter)\b/i,
  ],
  FINANCIAL: [
    /\b(transfer|wire|payment|authorize.*\$|approve.*budget)\b/i,
    /\b\$\d{1,3}(,\d{3})*(\.\d{2})?\b/,
  ],
};

class RiskDetector {
  /**
   * @param {import('./risk-signal-registry').RiskSignalRegistry} [registry] - Optional signal registry for extended signals
   */
  constructor(registry) {
    this._registry = registry || null;
  }

  detect(text) {
    // If registry available, delegate to it (includes base + extended signals)
    if (this._registry) {
      return this._registry.detect(text);
    }

    // Fallback to hardcoded patterns
    const signals = [];

    for (const [signal, patterns] of Object.entries(RISK_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          signals.push(signal);
          break;
        }
      }
    }

    return {
      signals,
      hasRisk: signals.length > 0,
      riskLevel: signals.length === 0 ? "low" : signals.length <= 2 ? "medium" : "high",
    };
  }
}

module.exports = { RiskDetector, RISK_PATTERNS };
