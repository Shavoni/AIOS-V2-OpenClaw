/**
 * DomainRegistry — Dynamic intent classification domain manager.
 *
 * Extends the base 5 domains from classifier.js with 10 additional vertical
 * domains. Provides pattern/keyword/exemplar access for both the keyword-based
 * IntentClassifier and the embedding-based EmbeddingClassifier.
 *
 * Usage:
 *   const { DomainRegistry, EXTENDED_DOMAIN_DEFINITIONS } = require('./domain-registry');
 *   const registry = new DomainRegistry();
 *   registry.registerDomain('Healthcare', EXTENDED_DOMAIN_DEFINITIONS.Healthcare);
 */

// ---------------------------------------------------------------------------
// Base domains — mirrors src/governance/classifier.js exactly
// ---------------------------------------------------------------------------

const BASE_DOMAINS = {
  Comms: {
    patterns: [/\b(email|slack|message|send|reply|draft\s*message|compose)\b/i],
    keywords: [
      'email', 'slack', 'message', 'send', 'reply', 'compose',
      'forward', 'cc', 'bcc', 'draft message',
    ],
    exemplar: 'email slack message send reply draft compose forward notification inbox',
  },
  Legal: {
    patterns: [/\b(contract|agreement|terms|legal|clause|liability|nda|compliance)\b/i],
    keywords: [
      'contract', 'agreement', 'terms', 'legal', 'clause',
      'liability', 'nda', 'compliance', 'regulation',
    ],
    exemplar: 'contract legal compliance agreement terms clause liability nda regulation',
  },
  HR: {
    patterns: [/\b(employee|hire|termina|salary|performance[\s.]review|onboard)\b/i],
    keywords: [
      'employee', 'hire', 'fire', 'salary', 'performance',
      'onboard', 'offboard', 'benefits', 'pto', 'termination',
    ],
    exemplar: 'employee hire salary performance review onboard benefits termination offboard',
  },
  Finance: {
    patterns: [/\b(invoice|payment|budget|expense|revenue|financial|accounting)\b/i],
    keywords: [
      'invoice', 'payment', 'budget', 'expense', 'revenue',
      'financial', 'accounting', 'transaction',
    ],
    exemplar: 'invoice payment budget expense revenue financial accounting transaction ledger',
  },
  DevOps: {
    patterns: [/\b(deploy|server|docker|ci[\s./-]?cd|pipeline|infrastructure|kubernetes)\b/i],
    keywords: [
      'deploy', 'server', 'docker', 'cicd', 'pipeline',
      'infrastructure', 'kubernetes', 'aws', 'ci/cd',
    ],
    exemplar: 'deploy server docker cicd pipeline infrastructure kubernetes aws container',
  },
  General: {
    patterns: [],
    keywords: [],
    exemplar: 'general purpose task question help information request',
  },
};

// ---------------------------------------------------------------------------
// Extended domain definitions — 10 new vertical domains
// ---------------------------------------------------------------------------

const EXTENDED_DOMAIN_DEFINITIONS = {
  Healthcare: {
    patterns: [
      /\b(patient|diagnosis|diagnos[ei]s|treatment|medication|prescription)\b/i,
      /\b(lab[\s-]?result|vitals|clinical|medical[\s-]?record|symptom)\b/i,
      /\b(hospital|physician|nurse|pharmacy|radiology|pathology)\b/i,
      /\bICD[\s-]?1[01]\b/i,
      /\bHL7|FHIR\b/i,
    ],
    keywords: [
      'patient', 'diagnosis', 'treatment', 'medication', 'prescription',
      'lab result', 'vitals', 'clinical', 'medical record', 'symptom',
      'hospital', 'physician', 'nurse', 'pharmacy', 'radiology',
      'pathology', 'telehealth', 'discharge', 'prognosis', 'referral',
    ],
    exemplar: 'patient diagnosis treatment medication prescription lab result vitals clinical medical record symptom hospital',
  },

  Education: {
    patterns: [
      /\b(student|grade|curriculum|enrollment|transcript)\b/i,
      /\b(assignment|course|tuition|financial[\s-]?aid|GPA)\b/i,
      /\b(semester|syllabus|dean|registrar|accreditation)\b/i,
      /\b(undergraduate|graduate|faculty|professor|lecture)\b/i,
    ],
    keywords: [
      'student', 'grade', 'curriculum', 'enrollment', 'transcript',
      'assignment', 'course', 'tuition', 'financial aid', 'gpa',
      'semester', 'syllabus', 'dean', 'registrar', 'accreditation',
      'professor', 'lecture', 'class schedule', 'degree', 'diploma',
    ],
    exemplar: 'student grade curriculum enrollment transcript assignment course tuition financial aid GPA semester',
  },

  Safety: {
    patterns: [
      /\b(incident|injury|hazard|OSHA|evacuation)\b/i,
      /\b(accident[\s-]?report|near[\s-]?miss|safety[\s-]?violation)\b/i,
      /\b(workplace[\s-]?injury|safety[\s-]?audit|lockout[\s-]?tagout)\b/i,
      /\bPPE\b/,
      /\bSDS|MSDS\b/,
    ],
    keywords: [
      'incident', 'injury', 'hazard', 'osha', 'evacuation',
      'accident report', 'near miss', 'safety violation', 'workplace injury',
      'safety audit', 'lockout tagout', 'ppe', 'fire drill', 'first aid',
      'safety inspection', 'emergency response', 'sds', 'msds',
    ],
    exemplar: 'incident injury hazard OSHA evacuation accident report near miss safety violation workplace injury PPE',
  },

  Operations: {
    patterns: [
      /\b(inventory|scheduling|dispatch|production|maintenance)\b/i,
      /\b(workflow|supply[\s-]?chain|warehouse|logistics)\b/i,
      /\b(procurement|vendor[\s-]?management|capacity[\s-]?planning)\b/i,
      /\b(quality[\s-]?control|lean|six[\s-]?sigma|kanban)\b/i,
    ],
    keywords: [
      'inventory', 'scheduling', 'dispatch', 'production', 'maintenance',
      'workflow', 'supply chain', 'warehouse', 'logistics', 'procurement',
      'vendor management', 'capacity planning', 'quality control',
      'lean', 'six sigma', 'kanban', 'shipment', 'fulfillment',
    ],
    exemplar: 'inventory scheduling dispatch production maintenance workflow supply chain warehouse logistics procurement',
  },

  CustomerService: {
    patterns: [
      /\b(complaint|refund|return|satisfaction|support[\s-]?ticket)\b/i,
      /\b(customer[\s-]?feedback|warranty|escalation)\b/i,
      /\b(SLA|NPS|CSAT|first[\s-]?call[\s-]?resolution)\b/i,
      /\b(help[\s-]?desk|call[\s-]?center|contact[\s-]?center)\b/i,
    ],
    keywords: [
      'complaint', 'refund', 'return', 'satisfaction', 'support ticket',
      'customer feedback', 'warranty', 'escalation', 'sla', 'nps',
      'csat', 'first call resolution', 'help desk', 'call center',
      'contact center', 'resolution', 'case', 'issue', 'service request',
    ],
    exemplar: 'complaint refund return satisfaction support ticket customer feedback warranty escalation SLA NPS',
  },

  Marketing: {
    patterns: [
      /\b(campaign|promotion|ad[\s-]?copy|social[\s-]?media[\s-]?post|SEO)\b/i,
      /\b(branding|newsletter|press[\s-]?release|content[\s-]?calendar)\b/i,
      /\b(CTR|CPC|CPM|conversion[\s-]?rate|marketing[\s-]?funnel)\b/i,
      /\b(A\/B[\s-]?test|landing[\s-]?page|email[\s-]?blast|drip[\s-]?campaign)\b/i,
    ],
    keywords: [
      'campaign', 'promotion', 'ad copy', 'social media post', 'seo',
      'branding', 'newsletter', 'press release', 'content calendar',
      'ctr', 'cpc', 'cpm', 'conversion rate', 'marketing funnel',
      'a/b test', 'landing page', 'email blast', 'drip campaign',
      'influencer', 'brand awareness',
    ],
    exemplar: 'campaign promotion ad copy social media post SEO branding newsletter press release content calendar',
  },

  Compliance: {
    patterns: [
      /\b(audit|inspection|violation|regulation|filing)\b/i,
      /\b(certification|accreditation|regulatory|policy[\s-]?review)\b/i,
      /\b(SOX|GDPR|HIPAA|CCPA|PCI[\s-]?DSS)\b/i,
      /\b(internal[\s-]?controls|compliance[\s-]?officer|remediation)\b/i,
    ],
    keywords: [
      'audit', 'inspection', 'violation', 'regulation', 'filing',
      'certification', 'accreditation', 'regulatory', 'policy review',
      'sox', 'gdpr', 'hipaa', 'ccpa', 'pci dss', 'internal controls',
      'compliance officer', 'remediation', 'due diligence', 'risk assessment',
    ],
    exemplar: 'audit inspection violation regulation filing certification accreditation regulatory policy review SOX GDPR HIPAA',
  },

  ClinicalResearch: {
    patterns: [
      /\b(clinical[\s-]?trial|IRB|informed[\s-]?consent|adverse[\s-]?event)\b/i,
      /\b(protocol|study[\s-]?participant|FDA[\s-]?submission)\b/i,
      /\b(placebo|double[\s-]?blind|randomized|phase[\s-]?[I1-4]{1,3})\b/i,
      /\b(principal[\s-]?investigator|sponsor|CRO|endpoint)\b/i,
      /\b(GCP|ICH|IND[\s-]?application)\b/i,
    ],
    keywords: [
      'clinical trial', 'irb', 'informed consent', 'adverse event',
      'protocol', 'study participant', 'fda submission', 'placebo',
      'double blind', 'randomized', 'principal investigator', 'sponsor',
      'cro', 'endpoint', 'gcp', 'ich', 'ind application',
      'cohort', 'bioequivalence', 'pharmacovigilance',
    ],
    exemplar: 'clinical trial IRB informed consent adverse event protocol study participant FDA submission randomized',
  },

  RealEstate: {
    patterns: [
      /\b(listing|lease|tenant|property|appraisal)\b/i,
      /\b(closing|mortgage|zoning|escrow)\b/i,
      /\b(title[\s-]?search|HOA|MLS|deed|foreclosure)\b/i,
      /\b(real[\s-]?estate[\s-]?agent|broker|open[\s-]?house|square[\s-]?footage)\b/i,
    ],
    keywords: [
      'listing', 'lease', 'tenant', 'property', 'appraisal',
      'closing', 'mortgage', 'zoning', 'escrow', 'title search',
      'hoa', 'mls', 'deed', 'foreclosure', 'real estate agent',
      'broker', 'open house', 'square footage', 'commercial property',
      'residential', 'condominium',
    ],
    exemplar: 'listing lease tenant property appraisal closing mortgage zoning escrow title search MLS deed',
  },

  Agriculture: {
    patterns: [
      /\b(crop|livestock|yield|irrigation|pesticide)\b/i,
      /\b(harvest|soil|farming|ranch)\b/i,
      /\b(USDA|agronomy|fertilizer|seed[\s-]?variety)\b/i,
      /\b(organic[\s-]?certification|greenhouse|hydroponics|precision[\s-]?ag)\b/i,
    ],
    keywords: [
      'crop', 'livestock', 'yield', 'irrigation', 'pesticide',
      'harvest', 'soil', 'farming', 'ranch', 'usda',
      'agronomy', 'fertilizer', 'seed variety', 'organic certification',
      'greenhouse', 'hydroponics', 'precision ag', 'tillage',
      'pasture', 'commodity', 'grain elevator',
    ],
    exemplar: 'crop livestock yield irrigation pesticide harvest soil farming ranch USDA agronomy fertilizer',
  },
};

// ---------------------------------------------------------------------------
// DomainRegistry class
// ---------------------------------------------------------------------------

class DomainRegistry {
  /**
   * Creates a new DomainRegistry pre-loaded with the 5 base domains + General.
   */
  constructor() {
    /** @type {Map<string, {patterns: RegExp[], keywords: string[], exemplar: string}>} */
    this._domains = new Map();

    // Seed with base domains
    for (const [id, config] of Object.entries(BASE_DOMAINS)) {
      this._domains.set(id, {
        patterns: [...config.patterns],
        keywords: [...config.keywords],
        exemplar: config.exemplar,
      });
    }
  }

  /**
   * Register a new domain or overwrite an existing one.
   *
   * @param {string} id          - Domain identifier (e.g. "Healthcare")
   * @param {Object} config
   * @param {RegExp[]} config.patterns  - Regex patterns for keyword-based matching
   * @param {string[]} config.keywords  - Simple keyword strings
   * @param {string}   config.exemplar  - Exemplar sentence for embedding classifier
   * @returns {void}
   */
  registerDomain(id, { patterns = [], keywords = [], exemplar = '' } = {}) {
    if (!id || typeof id !== 'string') {
      throw new Error('Domain id must be a non-empty string');
    }
    this._domains.set(id, {
      patterns: [...patterns],
      keywords: [...keywords],
      exemplar,
    });
  }

  /**
   * Retrieve a domain config by id.
   * @param {string} id
   * @returns {{patterns: RegExp[], keywords: string[], exemplar: string}|null}
   */
  getDomain(id) {
    return this._domains.get(id) || null;
  }

  /**
   * List all registered domains.
   * @returns {IterableIterator<[string, {patterns: RegExp[], keywords: string[], exemplar: string}]>}
   */
  listDomains() {
    return this._domains.entries();
  }

  /**
   * Check if a domain is registered.
   * @param {string} id
   * @returns {boolean}
   */
  hasDomain(id) {
    return this._domains.has(id);
  }

  /**
   * Bulk-register domains from a governance template object.
   *
   * Expected shape:
   *   template.governance.additionalDomains = {
   *     SomeDomain: { patterns: [...], keywords: [...], exemplar: '...' },
   *     ...
   *   }
   *
   * @param {Object} template - Template object with a `.governance.additionalDomains` map
   * @returns {string[]} List of domain ids that were registered
   */
  applyTemplate(template) {
    const registered = [];
    const domains =
      template &&
      template.governance &&
      template.governance.additionalDomains;

    if (!domains) return registered;

    // Accept array of domain name strings (look up from EXTENDED_DOMAIN_DEFINITIONS)
    if (Array.isArray(domains)) {
      for (const id of domains) {
        if (this.hasDomain(id)) continue;
        const config = EXTENDED_DOMAIN_DEFINITIONS[id];
        if (config) {
          this.registerDomain(id, config);
          registered.push(id);
        }
      }
      return registered;
    }

    // Also accept object map { DomainName: config }
    if (typeof domains === 'object') {
      for (const [id, config] of Object.entries(domains)) {
        this.registerDomain(id, config);
        registered.push(id);
      }
    }
    return registered;
  }

  /**
   * Return a Map of domain id -> RegExp[] for consumption by IntentClassifier.
   * @returns {Map<string, RegExp[]>}
   */
  getPatterns() {
    const map = new Map();
    for (const [id, config] of this._domains) {
      map.set(id, config.patterns);
    }
    return map;
  }

  /**
   * Return a Map of domain id -> exemplar string for consumption by EmbeddingClassifier.
   * @returns {Map<string, string>}
   */
  getExemplars() {
    const map = new Map();
    for (const [id, config] of this._domains) {
      if (config.exemplar) {
        map.set(id, config.exemplar);
      }
    }
    return map;
  }
}

module.exports = { DomainRegistry, EXTENDED_DOMAIN_DEFINITIONS };
