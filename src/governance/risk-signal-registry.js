/**
 * RiskSignalRegistry — Dynamic risk signal detection pattern manager.
 *
 * Extends the base 4 risk signals from risk-detector.js with 10 additional
 * domain-specific signal categories. Each signal carries:
 *   - patterns   : RegExp[] for text scanning
 *   - hitlMode   : default HITL escalation mode when triggered
 *   - localOnly  : whether triggering forces local-only LLM routing
 *
 * Usage:
 *   const { RiskSignalRegistry, EXTENDED_RISK_SIGNALS } = require('./risk-signal-registry');
 *   const registry = new RiskSignalRegistry();
 *   registry.registerSignal('PHI', EXTENDED_RISK_SIGNALS.PHI);
 *   const result = registry.detect('Patient MRN: 12345 has elevated blood pressure');
 */

// ---------------------------------------------------------------------------
// Base signals — mirrors src/governance/risk-detector.js exactly
// ---------------------------------------------------------------------------

const BASE_SIGNALS = {
  PII: {
    patterns: [
      /\b\d{3}-\d{2}-\d{4}\b/,                                         // SSN (xxx-xx-xxxx)
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,           // Email address
      /\b\d{3}[- ]?\d{3}[- ]?\d{4}\b/,                                 // US phone number
      /\b(ssn|social[\s.-]?security|date[\s.-]?of[\s.-]?birth|passport[\s.-]?number)\b/i,
    ],
    hitlMode: 'DRAFT',
    localOnly: true,
  },
  LEGAL_CONTRACT: {
    patterns: [
      /\b(hereby|whereas|party\s+of\s+the\s+first|binding\s+agreement|shall\s+be\s+liable)\b/i,
      /\b(sign|execute)\s*(a\s+|the\s+)?(contract|agreement|nda)\b/i,
      /\b(indemnif|arbitrat|jurisdiction|governing\s+law)\b/i,
    ],
    hitlMode: 'DRAFT',
    localOnly: false,
  },
  PUBLIC_STATEMENT: {
    patterns: [
      /\b(press[\s.-]?release|public[\s.-]?statement|announce|publish|post[\s.-]?publicly|social[\s.-]?media[\s.-]?post)\b/i,
      /\b(tweet|linkedin[\s.-]?post|blog[\s.-]?post|newsletter)\b/i,
    ],
    hitlMode: 'ESCALATE',
    localOnly: false,
  },
  FINANCIAL: {
    patterns: [
      /\b(transfer|wire|payment|authorize\s*.*\$|approve\s*.*budget)\b/i,
      /\$\d{1,3}(,\d{3})*(\.\d{2})?\b/,                               // Dollar amounts ($1,234.56)
      /\b(wire\s+transfer|ach\s+transfer|direct\s+deposit)\b/i,
    ],
    hitlMode: 'ESCALATE',
    localOnly: false,
  },
};

// ---------------------------------------------------------------------------
// Extended risk signal definitions — 10 new signal categories
// ---------------------------------------------------------------------------

const EXTENDED_RISK_SIGNALS = {
  PHI: {
    patterns: [
      /\b(diagnosis|diagnos[ei]s|medication|patient[\s-]?id|medical[\s-]?record)\b/i,
      /\b(lab[\s-]?result|blood[\s-]?pressure|heart[\s-]?rate)\b/i,
      /\bMRN[\s:#]?\d+/i,                                              // Medical record number
      /\b(treatment[\s-]?plan|discharge[\s-]?summary)\b/i,
      /\b(HIPAA|protected[\s-]?health[\s-]?information)\b/i,
      /\b(vital[\s-]?signs|hemoglobin|A1C|BMI[\s:#]?\d)\b/i,
      /\b(attending[\s-]?physician|admitting[\s-]?diagnosis)\b/i,
    ],
    hitlMode: 'DRAFT',
    localOnly: true,
  },

  FERPA_DATA: {
    patterns: [
      /\b(student[\s-]?record|transcript|grade[\s-]?report)\b/i,
      /\b(disciplinary[\s-]?record|disciplinary[\s-]?action)\b/i,
      /\bIEP\b/,                                                       // Individualized Education Program
      /\b504[\s-]?plan\b/i,
      /\bstudent[\s-]?id[\s:#]?\d+/i,                                  // Student ID with number
      /\b(FERPA|education[\s-]?record|academic[\s-]?record)\b/i,
      /\b(enrollment[\s-]?status|class[\s-]?rank|cumulative[\s-]?GPA)\b/i,
    ],
    hitlMode: 'DRAFT',
    localOnly: true,
  },

  PAYMENT_CARD: {
    patterns: [
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,                   // 16-digit card number
      /\b(CVV|CVC|CVV2|CVC2)[\s:#]?\d{3,4}\b/i,                       // CVV with value
      /\b(CVV|CVC|CVV2|CVC2)\b/i,                                      // CVV mention alone
      /\b(expiration[\s-]?date|exp[\s-]?date|card[\s-]?expir)\b/i,
      /\b(cardholder[\s-]?name|cardholder)\b/i,
      /\bPAN\b/,                                                        // Primary Account Number
      /\b(card[\s-]?number|credit[\s-]?card|debit[\s-]?card)\b/i,
      /\b(PCI[\s-]?DSS|PCI[\s-]?compliance)\b/i,
      /\b(magnetic[\s-]?stripe|chip[\s-]?and[\s-]?pin|contactless[\s-]?payment)\b/i,
    ],
    hitlMode: 'ESCALATE',
    localOnly: true,
  },

  MINOR_DATA: {
    patterns: [
      /\b(child[\s-]?name|child'?s?\s+name)\b/i,
      /\b(student[\s-]?age|child'?s?\s+age|minor'?s?\s+age)\b/i,
      /\b(minor|juvenile|underage)\b/i,
      /\b(parent[\s-]?guardian|legal[\s-]?guardian|custodial[\s-]?parent)\b/i,
      /\b(custody|custodial[\s-]?agreement)\b/i,
      /\b(date[\s-]?of[\s-]?birth|DOB)\b/i,
      /\bunder[\s-]?1[38]\b/i,                                         // under 13 or under 18
      /\b(COPPA|CIPA|child[\s-]?protection)\b/i,
      /\b(parental[\s-]?consent|age[\s-]?verification)\b/i,
    ],
    hitlMode: 'ESCALATE',
    localOnly: true,
  },

  TRADE_SECRET: {
    patterns: [
      /\b(proprietary|confidential[\s-]?information|trade[\s-]?secret)\b/i,
      /\bNDA\b/i,
      /\b(source[\s-]?code|intellectual[\s-]?property|patent[\s-]?pending)\b/i,
      /\b(classified|restricted[\s-]?distribution|internal[\s-]?only)\b/i,
      /\b(non[\s-]?disclosure|non[\s-]?compete|non[\s-]?solicitation)\b/i,
      /\b(trade[\s-]?dress|copyright[\s-]?infringement|IP[\s-]?theft)\b/i,
    ],
    hitlMode: 'DRAFT',
    localOnly: true,
  },

  REGULATED_SUBSTANCE: {
    patterns: [
      /\b(controlled[\s-]?substance|schedule[\s-]?[IV]{1,3}|schedule[\s-]?[1-5])\b/i,
      /\bDEA[\s-]?number\b/i,
      /\b(narcotic|opioid|prescription[\s-]?drug)\b/i,
      /\b(benzodiazepine|amphetamine|barbiturate|methadone)\b/i,
      /\b(drug[\s-]?enforcement|PDMP|prescription[\s-]?monitoring)\b/i,
      /\b(dispensing[\s-]?log|controlled[\s-]?substance[\s-]?act)\b/i,
    ],
    hitlMode: 'ESCALATE',
    localOnly: true,
  },

  SAFETY_INCIDENT: {
    patterns: [
      /\b(workplace[\s-]?injury|occupational[\s-]?injury)\b/i,
      /\b(OSHA[\s-]?report|OSHA[\s-]?recordable|OSHA[\s-]?30[01])\b/i,
      /\b(near[\s-]?miss|close[\s-]?call)\b/i,
      /\b(fatality|fatal[\s-]?incident)\b/i,
      /\b(hazmat[\s-]?spill|chemical[\s-]?spill|hazardous[\s-]?material)\b/i,
      /\b(accident[\s-]?report|incident[\s-]?report)\b/i,
      /\b(workers[\s'-]?comp|workers[\s'-]?compensation)\b/i,
      /\b(lost[\s-]?time[\s-]?incident|TRIR|DART[\s-]?rate)\b/i,
    ],
    hitlMode: 'DRAFT',
    localOnly: false,
  },

  TENANT_DATA: {
    patterns: [
      /\b(tenant[\s-]?SSN|tenant[\s'-]?s?\s+social[\s-]?security)\b/i,
      /\b(rental[\s-]?application|lease[\s-]?application)\b/i,
      /\b(eviction|eviction[\s-]?notice|eviction[\s-]?proceedings)\b/i,
      /\b(lease[\s-]?violation|lease[\s-]?breach)\b/i,
      /\b(security[\s-]?deposit|damage[\s-]?deposit)\b/i,
      /\b(rent[\s-]?payment[\s-]?history|rental[\s-]?history)\b/i,
      /\b(tenant[\s-]?screening|background[\s-]?check[\s-]?tenant)\b/i,
      /\b(fair[\s-]?housing|housing[\s-]?discrimination)\b/i,
    ],
    hitlMode: 'DRAFT',
    localOnly: true,
  },

  CAMPAIGN_FINANCE: {
    patterns: [
      /\b(campaign[\s-]?contribution|campaign[\s-]?donation)\b/i,
      /\bPAC\b/,                                                        // Political Action Committee
      /\b(political[\s-]?donation|political[\s-]?contribution)\b/i,
      /\b(lobbying|lobbyist[\s-]?registration)\b/i,
      /\b(FEC[\s-]?filing|FEC[\s-]?report)\b/i,
      /\b(campaign[\s-]?fund|campaign[\s-]?finance)\b/i,
      /\b(super[\s-]?PAC|527[\s-]?organization|dark[\s-]?money)\b/i,
      /\b(bundling|in[\s-]?kind[\s-]?contribution|soft[\s-]?money)\b/i,
    ],
    hitlMode: 'ESCALATE',
    localOnly: false,
  },

  FOOD_SAFETY: {
    patterns: [
      /\b(allergen|food[\s-]?allergen|allergy[\s-]?warning)\b/i,
      /\b(contamination|cross[\s-]?contamination|adulteration)\b/i,
      /\b(food[\s-]?recall|product[\s-]?recall)\b/i,
      /\b(temperature[\s-]?log|cold[\s-]?chain|danger[\s-]?zone)\b/i,
      /\bHACCP\b/,                                                      // Hazard Analysis Critical Control Points
      /\b(foodborne|food[\s-]?poisoning|food[\s-]?borne[\s-]?illness)\b/i,
      /\b(FDA[\s-]?inspection|health[\s-]?inspection|sanitation)\b/i,
      /\b(listeria|salmonella|e[\s.]?coli|norovirus)\b/i,
    ],
    hitlMode: 'DRAFT',
    localOnly: false,
  },
};

// ---------------------------------------------------------------------------
// RiskSignalRegistry class
// ---------------------------------------------------------------------------

class RiskSignalRegistry {
  /**
   * Creates a new RiskSignalRegistry pre-loaded with the 4 base risk signals.
   */
  constructor() {
    /** @type {Map<string, {patterns: RegExp[], hitlMode: string, localOnly: boolean}>} */
    this._signals = new Map();

    // Seed with base signals
    for (const [name, config] of Object.entries(BASE_SIGNALS)) {
      this._signals.set(name, {
        patterns: [...config.patterns],
        hitlMode: config.hitlMode,
        localOnly: config.localOnly,
      });
    }
  }

  /**
   * Register a new risk signal or overwrite an existing one.
   *
   * @param {string} name           - Signal identifier (e.g. "PHI", "PAYMENT_CARD")
   * @param {Object} config
   * @param {RegExp[]}  config.patterns  - Regex patterns for detection
   * @param {string}    config.hitlMode  - Default HITL mode: "INFORM", "DRAFT", or "ESCALATE"
   * @param {boolean}   config.localOnly - Whether this signal forces local-only LLM routing
   * @returns {void}
   */
  registerSignal(name, { patterns = [], hitlMode = 'INFORM', localOnly = false } = {}) {
    if (!name || typeof name !== 'string') {
      throw new Error('Signal name must be a non-empty string');
    }
    this._signals.set(name, {
      patterns: [...patterns],
      hitlMode,
      localOnly,
    });
  }

  /**
   * Retrieve a signal config by name.
   * @param {string} name
   * @returns {{patterns: RegExp[], hitlMode: string, localOnly: boolean}|null}
   */
  getSignal(name) {
    return this._signals.get(name) || null;
  }

  /**
   * List all registered signals.
   * @returns {IterableIterator<[string, {patterns: RegExp[], hitlMode: string, localOnly: boolean}]>}
   */
  listSignals() {
    return this._signals.entries();
  }

  /**
   * Check if a signal is registered.
   * @param {string} name
   * @returns {boolean}
   */
  hasSignal(name) {
    return this._signals.has(name);
  }

  /**
   * Bulk-register signals from a governance template object.
   *
   * Expected shape:
   *   template.governance.riskSignals = {
   *     SIGNAL_NAME: { patterns: [...], hitlMode: '...', localOnly: true/false },
   *     ...
   *   }
   *
   * @param {Object} template - Template object with a `.governance.riskSignals` map
   * @returns {string[]} List of signal names that were registered
   */
  applyTemplate(template) {
    const registered = [];
    const signals =
      template &&
      template.governance &&
      template.governance.riskSignals;

    if (!signals) return registered;

    // Accept array of signal name strings (look up from EXTENDED_RISK_SIGNALS)
    if (Array.isArray(signals)) {
      for (const name of signals) {
        if (this.hasSignal(name)) continue;
        const config = EXTENDED_RISK_SIGNALS[name];
        if (config) {
          this.registerSignal(name, config);
          registered.push(name);
        }
      }
      return registered;
    }

    // Also accept object map { SIGNAL_NAME: config }
    if (typeof signals === 'object') {
      for (const [name, config] of Object.entries(signals)) {
        this.registerSignal(name, config);
        registered.push(name);
      }
    }
    return registered;
  }

  /**
   * Scan text against all registered signal patterns.
   *
   * @param {string} text - The input text to scan
   * @returns {{signals: string[], details: Map<string, {hitlMode: string, localOnly: boolean, matchedPattern: string}>}}
   */
  detect(text) {
    if (!text || typeof text !== 'string') {
      return { signals: [], details: new Map() };
    }

    const signals = [];
    const details = new Map();

    for (const [name, config] of this._signals) {
      for (const pattern of config.patterns) {
        // Reset regex lastIndex in case a pattern has the global flag
        if (pattern.lastIndex !== undefined) {
          pattern.lastIndex = 0;
        }

        const match = pattern.exec(text);
        if (match) {
          signals.push(name);
          details.set(name, {
            hitlMode: config.hitlMode,
            localOnly: config.localOnly,
            matchedPattern: pattern.source,
            matchedText: match[0],
          });
          break; // One match per signal is sufficient
        }
      }
    }

    return { signals, details };
  }
}

module.exports = { RiskSignalRegistry, EXTENDED_RISK_SIGNALS };
