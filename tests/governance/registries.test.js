const { DomainRegistry, EXTENDED_DOMAIN_DEFINITIONS } = require('../../src/governance/domain-registry');
const { RiskSignalRegistry, EXTENDED_RISK_SIGNALS } = require('../../src/governance/risk-signal-registry');

// ============================================================================
// DomainRegistry
// ============================================================================

describe('DomainRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new DomainRegistry();
  });

  // --------------------------------------------------------------------------
  // Constructor
  // --------------------------------------------------------------------------

  describe('constructor', () => {
    it('pre-loads 6 base domains: Comms, Legal, HR, Finance, DevOps, General', () => {
      const entries = Array.from(registry.listDomains());
      const names = entries.map(([id]) => id);

      expect(names).toHaveLength(6);
      expect(names).toContain('Comms');
      expect(names).toContain('Legal');
      expect(names).toContain('HR');
      expect(names).toContain('Finance');
      expect(names).toContain('DevOps');
      expect(names).toContain('General');
    });
  });

  // --------------------------------------------------------------------------
  // registerDomain
  // --------------------------------------------------------------------------

  describe('registerDomain()', () => {
    it('adds a new domain', () => {
      expect(registry.hasDomain('TestDomain')).toBe(false);

      registry.registerDomain('TestDomain', {
        patterns: [/\btest\b/i],
        keywords: ['test'],
        exemplar: 'test domain exemplar',
      });

      expect(registry.hasDomain('TestDomain')).toBe(true);

      const domain = registry.getDomain('TestDomain');
      expect(domain).not.toBeNull();
      expect(domain.patterns).toHaveLength(1);
      expect(domain.keywords).toEqual(['test']);
      expect(domain.exemplar).toBe('test domain exemplar');
    });

    it('throws on empty name', () => {
      expect(() => registry.registerDomain('', { patterns: [] })).toThrow(
        'Domain id must be a non-empty string'
      );
    });

    it('throws on null name', () => {
      expect(() => registry.registerDomain(null)).toThrow(
        'Domain id must be a non-empty string'
      );
    });

    it('throws on undefined name', () => {
      expect(() => registry.registerDomain(undefined)).toThrow(
        'Domain id must be a non-empty string'
      );
    });

    it('throws on non-string name (number)', () => {
      expect(() => registry.registerDomain(42)).toThrow(
        'Domain id must be a non-empty string'
      );
    });

    it('defaults patterns, keywords, and exemplar when config is omitted', () => {
      registry.registerDomain('Bare');
      const domain = registry.getDomain('Bare');
      expect(domain.patterns).toEqual([]);
      expect(domain.keywords).toEqual([]);
      expect(domain.exemplar).toBe('');
    });

    it('overwrites an existing domain with the same id', () => {
      registry.registerDomain('Custom', {
        patterns: [/first/],
        keywords: ['first'],
        exemplar: 'first exemplar',
      });
      registry.registerDomain('Custom', {
        patterns: [/second/],
        keywords: ['second'],
        exemplar: 'second exemplar',
      });

      const domain = registry.getDomain('Custom');
      expect(domain.keywords).toEqual(['second']);
      expect(domain.exemplar).toBe('second exemplar');
    });
  });

  // --------------------------------------------------------------------------
  // getDomain
  // --------------------------------------------------------------------------

  describe('getDomain()', () => {
    it('returns the domain config for a registered domain', () => {
      const comms = registry.getDomain('Comms');
      expect(comms).not.toBeNull();
      expect(comms.patterns).toBeInstanceOf(Array);
      expect(comms.keywords).toBeInstanceOf(Array);
      expect(typeof comms.exemplar).toBe('string');
    });

    it('returns null for an unregistered domain', () => {
      expect(registry.getDomain('NonExistent')).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // hasDomain
  // --------------------------------------------------------------------------

  describe('hasDomain()', () => {
    it('returns true for a registered domain', () => {
      expect(registry.hasDomain('Comms')).toBe(true);
      expect(registry.hasDomain('Legal')).toBe(true);
      expect(registry.hasDomain('HR')).toBe(true);
      expect(registry.hasDomain('Finance')).toBe(true);
      expect(registry.hasDomain('DevOps')).toBe(true);
      expect(registry.hasDomain('General')).toBe(true);
    });

    it('returns false for an unregistered domain', () => {
      expect(registry.hasDomain('Healthcare')).toBe(false);
      expect(registry.hasDomain('FakeDomain')).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // listDomains
  // --------------------------------------------------------------------------

  describe('listDomains()', () => {
    it('returns an iterable of all domain entries', () => {
      const entries = Array.from(registry.listDomains());
      expect(entries).toHaveLength(6);

      // Each entry should be a [string, config] pair
      for (const [id, config] of entries) {
        expect(typeof id).toBe('string');
        expect(config).toHaveProperty('patterns');
        expect(config).toHaveProperty('keywords');
        expect(config).toHaveProperty('exemplar');
      }
    });

    it('reflects newly added domains', () => {
      registry.registerDomain('NewOne', { patterns: [], keywords: [], exemplar: '' });
      const entries = Array.from(registry.listDomains());
      expect(entries).toHaveLength(7);
      const names = entries.map(([id]) => id);
      expect(names).toContain('NewOne');
    });
  });

  // --------------------------------------------------------------------------
  // applyTemplate — array form
  // --------------------------------------------------------------------------

  describe('applyTemplate() with array of domain names', () => {
    it('loads domains from EXTENDED_DOMAIN_DEFINITIONS', () => {
      const template = {
        governance: {
          additionalDomains: ['Healthcare', 'Education'],
        },
      };

      const registered = registry.applyTemplate(template);

      expect(registered).toContain('Healthcare');
      expect(registered).toContain('Education');
      expect(registry.hasDomain('Healthcare')).toBe(true);
      expect(registry.hasDomain('Education')).toBe(true);
    });

    it('returns list of registered domain names', () => {
      const template = {
        governance: {
          additionalDomains: ['Safety', 'Operations'],
        },
      };

      const registered = registry.applyTemplate(template);
      expect(registered).toEqual(['Safety', 'Operations']);
    });

    it('skips already-registered domains', () => {
      // Pre-register Healthcare
      registry.registerDomain('Healthcare', EXTENDED_DOMAIN_DEFINITIONS.Healthcare);

      const template = {
        governance: {
          additionalDomains: ['Healthcare', 'Education'],
        },
      };

      const registered = registry.applyTemplate(template);

      // Healthcare was already registered, so only Education should appear
      expect(registered).toEqual(['Education']);
      expect(registry.hasDomain('Healthcare')).toBe(true);
      expect(registry.hasDomain('Education')).toBe(true);
    });

    it('skips names that do not exist in EXTENDED_DOMAIN_DEFINITIONS', () => {
      const template = {
        governance: {
          additionalDomains: ['Healthcare', 'BogusNonExistent'],
        },
      };

      const registered = registry.applyTemplate(template);
      expect(registered).toEqual(['Healthcare']);
      expect(registry.hasDomain('BogusNonExistent')).toBe(false);
    });

    it('returns empty array for empty domains array', () => {
      const template = { governance: { additionalDomains: [] } };
      const registered = registry.applyTemplate(template);
      expect(registered).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // applyTemplate — object map form
  // --------------------------------------------------------------------------

  describe('applyTemplate() with object map', () => {
    it('registers domains from an object map of { name: config }', () => {
      const template = {
        governance: {
          additionalDomains: {
            CustomA: {
              patterns: [/\bcustom_a\b/i],
              keywords: ['custom_a'],
              exemplar: 'custom a domain',
            },
            CustomB: {
              patterns: [/\bcustom_b\b/i],
              keywords: ['custom_b'],
              exemplar: 'custom b domain',
            },
          },
        },
      };

      const registered = registry.applyTemplate(template);

      expect(registered).toEqual(['CustomA', 'CustomB']);
      expect(registry.hasDomain('CustomA')).toBe(true);
      expect(registry.hasDomain('CustomB')).toBe(true);

      const a = registry.getDomain('CustomA');
      expect(a.keywords).toEqual(['custom_a']);
    });
  });

  // --------------------------------------------------------------------------
  // applyTemplate — edge cases
  // --------------------------------------------------------------------------

  describe('applyTemplate() edge cases', () => {
    it('returns empty array when template is null', () => {
      expect(registry.applyTemplate(null)).toEqual([]);
    });

    it('returns empty array when template has no governance key', () => {
      expect(registry.applyTemplate({})).toEqual([]);
    });

    it('returns empty array when governance has no additionalDomains key', () => {
      expect(registry.applyTemplate({ governance: {} })).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // getPatterns
  // --------------------------------------------------------------------------

  describe('getPatterns()', () => {
    it('returns a Map of domain -> RegExp[]', () => {
      const patterns = registry.getPatterns();

      expect(patterns).toBeInstanceOf(Map);
      expect(patterns.size).toBe(6);

      for (const [id, regexes] of patterns) {
        expect(typeof id).toBe('string');
        expect(Array.isArray(regexes)).toBe(true);
        for (const rx of regexes) {
          expect(rx).toBeInstanceOf(RegExp);
        }
      }
    });

    it('includes patterns from newly registered domains', () => {
      registry.registerDomain('Healthcare', EXTENDED_DOMAIN_DEFINITIONS.Healthcare);
      const patterns = registry.getPatterns();
      expect(patterns.has('Healthcare')).toBe(true);
      expect(patterns.get('Healthcare').length).toBeGreaterThan(0);
    });

    it('General domain has an empty patterns array', () => {
      const patterns = registry.getPatterns();
      expect(patterns.get('General')).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // getExemplars
  // --------------------------------------------------------------------------

  describe('getExemplars()', () => {
    it('returns a Map of domain -> string', () => {
      const exemplars = registry.getExemplars();

      expect(exemplars).toBeInstanceOf(Map);

      for (const [id, text] of exemplars) {
        expect(typeof id).toBe('string');
        expect(typeof text).toBe('string');
        expect(text.length).toBeGreaterThan(0);
      }
    });

    it('does not include domains with empty exemplar strings', () => {
      registry.registerDomain('NoExemplar', {
        patterns: [/test/],
        keywords: ['test'],
        exemplar: '',
      });

      const exemplars = registry.getExemplars();
      expect(exemplars.has('NoExemplar')).toBe(false);
    });

    it('includes exemplars from newly registered domains', () => {
      registry.registerDomain('Healthcare', EXTENDED_DOMAIN_DEFINITIONS.Healthcare);
      const exemplars = registry.getExemplars();
      expect(exemplars.has('Healthcare')).toBe(true);
      expect(exemplars.get('Healthcare')).toMatch(/patient/i);
    });
  });
});

// ============================================================================
// RiskSignalRegistry
// ============================================================================

describe('RiskSignalRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new RiskSignalRegistry();
  });

  // --------------------------------------------------------------------------
  // Constructor
  // --------------------------------------------------------------------------

  describe('constructor', () => {
    it('pre-loads 4 base signals: PII, LEGAL_CONTRACT, PUBLIC_STATEMENT, FINANCIAL', () => {
      const entries = Array.from(registry.listSignals());
      const names = entries.map(([name]) => name);

      expect(names).toHaveLength(4);
      expect(names).toContain('PII');
      expect(names).toContain('LEGAL_CONTRACT');
      expect(names).toContain('PUBLIC_STATEMENT');
      expect(names).toContain('FINANCIAL');
    });
  });

  // --------------------------------------------------------------------------
  // registerSignal
  // --------------------------------------------------------------------------

  describe('registerSignal()', () => {
    it('adds a new signal', () => {
      expect(registry.hasSignal('CUSTOM')).toBe(false);

      registry.registerSignal('CUSTOM', {
        patterns: [/\bcustom\b/i],
        hitlMode: 'INFORM',
        localOnly: false,
      });

      expect(registry.hasSignal('CUSTOM')).toBe(true);

      const signal = registry.getSignal('CUSTOM');
      expect(signal).not.toBeNull();
      expect(signal.patterns).toHaveLength(1);
      expect(signal.hitlMode).toBe('INFORM');
      expect(signal.localOnly).toBe(false);
    });

    it('throws on empty name', () => {
      expect(() => registry.registerSignal('', { patterns: [] })).toThrow(
        'Signal name must be a non-empty string'
      );
    });

    it('throws on null name', () => {
      expect(() => registry.registerSignal(null)).toThrow(
        'Signal name must be a non-empty string'
      );
    });

    it('throws on undefined name', () => {
      expect(() => registry.registerSignal(undefined)).toThrow(
        'Signal name must be a non-empty string'
      );
    });

    it('throws on non-string name (number)', () => {
      expect(() => registry.registerSignal(123)).toThrow(
        'Signal name must be a non-empty string'
      );
    });

    it('defaults patterns, hitlMode, and localOnly when config is omitted', () => {
      registry.registerSignal('Bare');
      const signal = registry.getSignal('Bare');
      expect(signal.patterns).toEqual([]);
      expect(signal.hitlMode).toBe('INFORM');
      expect(signal.localOnly).toBe(false);
    });

    it('overwrites an existing signal with the same name', () => {
      registry.registerSignal('OVER', {
        patterns: [/first/],
        hitlMode: 'DRAFT',
        localOnly: true,
      });
      registry.registerSignal('OVER', {
        patterns: [/second/],
        hitlMode: 'ESCALATE',
        localOnly: false,
      });

      const signal = registry.getSignal('OVER');
      expect(signal.hitlMode).toBe('ESCALATE');
      expect(signal.localOnly).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // getSignal
  // --------------------------------------------------------------------------

  describe('getSignal()', () => {
    it('returns the signal config for a registered signal', () => {
      const pii = registry.getSignal('PII');
      expect(pii).not.toBeNull();
      expect(pii.patterns).toBeInstanceOf(Array);
      expect(pii.hitlMode).toBe('DRAFT');
      expect(pii.localOnly).toBe(true);
    });

    it('returns null for an unregistered signal', () => {
      expect(registry.getSignal('NON_EXISTENT')).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // hasSignal
  // --------------------------------------------------------------------------

  describe('hasSignal()', () => {
    it('returns true for all base signals', () => {
      expect(registry.hasSignal('PII')).toBe(true);
      expect(registry.hasSignal('LEGAL_CONTRACT')).toBe(true);
      expect(registry.hasSignal('PUBLIC_STATEMENT')).toBe(true);
      expect(registry.hasSignal('FINANCIAL')).toBe(true);
    });

    it('returns false for an unregistered signal', () => {
      expect(registry.hasSignal('PHI')).toBe(false);
      expect(registry.hasSignal('FAKE_SIGNAL')).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // listSignals
  // --------------------------------------------------------------------------

  describe('listSignals()', () => {
    it('returns an iterable of all signal entries', () => {
      const entries = Array.from(registry.listSignals());
      expect(entries).toHaveLength(4);

      for (const [name, config] of entries) {
        expect(typeof name).toBe('string');
        expect(config).toHaveProperty('patterns');
        expect(config).toHaveProperty('hitlMode');
        expect(config).toHaveProperty('localOnly');
      }
    });

    it('reflects newly added signals', () => {
      registry.registerSignal('NEW_SIG', { patterns: [], hitlMode: 'INFORM', localOnly: false });
      const entries = Array.from(registry.listSignals());
      expect(entries).toHaveLength(5);
      const names = entries.map(([name]) => name);
      expect(names).toContain('NEW_SIG');
    });
  });

  // --------------------------------------------------------------------------
  // detect
  // --------------------------------------------------------------------------

  describe('detect()', () => {
    it('finds PII in text containing an SSN', () => {
      const result = registry.detect('SSN: 123-45-6789');
      expect(result.signals).toContain('PII');
    });

    it('finds PII in text containing an email address', () => {
      const result = registry.detect('Contact me at user@example.com for details');
      expect(result.signals).toContain('PII');
    });

    it('finds FINANCIAL in text about wire transfers', () => {
      const result = registry.detect('wire transfer $50,000');
      expect(result.signals).toContain('FINANCIAL');
    });

    it('finds LEGAL_CONTRACT in text with legal language', () => {
      const result = registry.detect('The party hereby agrees to the binding agreement');
      expect(result.signals).toContain('LEGAL_CONTRACT');
    });

    it('finds PUBLIC_STATEMENT in text about press releases', () => {
      const result = registry.detect('Please draft a press release about the merger');
      expect(result.signals).toContain('PUBLIC_STATEMENT');
    });

    it('returns empty for innocuous text', () => {
      const result = registry.detect('The weather is nice today');
      expect(result.signals).toHaveLength(0);
      expect(result.details.size).toBe(0);
    });

    it('returns signals array and details Map', () => {
      const result = registry.detect('SSN: 123-45-6789');
      expect(Array.isArray(result.signals)).toBe(true);
      expect(result.details).toBeInstanceOf(Map);
    });

    it('details Map contains hitlMode, localOnly, matchedPattern, and matchedText', () => {
      const result = registry.detect('SSN: 123-45-6789');
      expect(result.details.has('PII')).toBe(true);

      const detail = result.details.get('PII');
      expect(detail).toHaveProperty('hitlMode');
      expect(detail).toHaveProperty('localOnly');
      expect(detail).toHaveProperty('matchedPattern');
      expect(detail).toHaveProperty('matchedText');
    });

    it('detects multiple signals in the same text', () => {
      const text = 'SSN: 123-45-6789 and we hereby agree to binding agreement for wire transfer $10,000';
      const result = registry.detect(text);

      expect(result.signals).toContain('PII');
      expect(result.signals).toContain('LEGAL_CONTRACT');
      expect(result.signals).toContain('FINANCIAL');
      expect(result.signals.length).toBeGreaterThanOrEqual(3);
    });

    it('returns empty for null input', () => {
      const result = registry.detect(null);
      expect(result.signals).toEqual([]);
      expect(result.details.size).toBe(0);
    });

    it('returns empty for empty string', () => {
      const result = registry.detect('');
      expect(result.signals).toEqual([]);
      expect(result.details.size).toBe(0);
    });

    it('returns empty for non-string input', () => {
      const result = registry.detect(42);
      expect(result.signals).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // applyTemplate — array form
  // --------------------------------------------------------------------------

  describe('applyTemplate() with array of signal names', () => {
    it('loads signals from EXTENDED_RISK_SIGNALS', () => {
      const template = {
        governance: {
          riskSignals: ['PHI', 'FERPA_DATA'],
        },
      };

      const registered = registry.applyTemplate(template);

      expect(registered).toContain('PHI');
      expect(registered).toContain('FERPA_DATA');
      expect(registry.hasSignal('PHI')).toBe(true);
      expect(registry.hasSignal('FERPA_DATA')).toBe(true);
    });

    it('returns list of registered signal names', () => {
      const template = {
        governance: {
          riskSignals: ['PAYMENT_CARD', 'MINOR_DATA'],
        },
      };

      const registered = registry.applyTemplate(template);
      expect(registered).toEqual(['PAYMENT_CARD', 'MINOR_DATA']);
    });

    it('skips already-registered signals', () => {
      // Pre-register PHI
      registry.registerSignal('PHI', EXTENDED_RISK_SIGNALS.PHI);

      const template = {
        governance: {
          riskSignals: ['PHI', 'FERPA_DATA'],
        },
      };

      const registered = registry.applyTemplate(template);
      expect(registered).toEqual(['FERPA_DATA']);
    });

    it('skips names that do not exist in EXTENDED_RISK_SIGNALS', () => {
      const template = {
        governance: {
          riskSignals: ['PHI', 'TOTALLY_BOGUS'],
        },
      };

      const registered = registry.applyTemplate(template);
      expect(registered).toEqual(['PHI']);
      expect(registry.hasSignal('TOTALLY_BOGUS')).toBe(false);
    });

    it('returns empty array for empty signals array', () => {
      const template = { governance: { riskSignals: [] } };
      const registered = registry.applyTemplate(template);
      expect(registered).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // applyTemplate — object map form
  // --------------------------------------------------------------------------

  describe('applyTemplate() with object map', () => {
    it('registers signals from an object map of { name: config }', () => {
      const template = {
        governance: {
          riskSignals: {
            CUSTOM_A: {
              patterns: [/\bcustom_a\b/i],
              hitlMode: 'DRAFT',
              localOnly: true,
            },
            CUSTOM_B: {
              patterns: [/\bcustom_b\b/i],
              hitlMode: 'ESCALATE',
              localOnly: false,
            },
          },
        },
      };

      const registered = registry.applyTemplate(template);
      expect(registered).toEqual(['CUSTOM_A', 'CUSTOM_B']);
      expect(registry.hasSignal('CUSTOM_A')).toBe(true);
      expect(registry.hasSignal('CUSTOM_B')).toBe(true);

      const a = registry.getSignal('CUSTOM_A');
      expect(a.hitlMode).toBe('DRAFT');
      expect(a.localOnly).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // applyTemplate — edge cases
  // --------------------------------------------------------------------------

  describe('applyTemplate() edge cases', () => {
    it('returns empty array when template is null', () => {
      expect(registry.applyTemplate(null)).toEqual([]);
    });

    it('returns empty array when template has no governance key', () => {
      expect(registry.applyTemplate({})).toEqual([]);
    });

    it('returns empty array when governance has no riskSignals key', () => {
      expect(registry.applyTemplate({ governance: {} })).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // detect after applyTemplate — extended signals in action
  // --------------------------------------------------------------------------

  describe('detect() with extended signals', () => {
    beforeEach(() => {
      registry.applyTemplate({
        governance: {
          riskSignals: ['PHI', 'FERPA_DATA'],
        },
      });
    });

    it('finds PHI in "patient diagnosis"', () => {
      const result = registry.detect('patient diagnosis indicates elevated glucose');
      expect(result.signals).toContain('PHI');
    });

    it('finds PHI in medical record text', () => {
      const result = registry.detect('MRN:12345 has new lab result');
      expect(result.signals).toContain('PHI');
    });

    it('finds FERPA_DATA in "student transcript"', () => {
      const result = registry.detect('Please release the student transcript');
      expect(result.signals).toContain('FERPA_DATA');
    });

    it('finds FERPA_DATA in text about academic records', () => {
      const result = registry.detect('Update the academic record for enrollment status');
      expect(result.signals).toContain('FERPA_DATA');
    });

    it('still detects base signals after applying extended signals', () => {
      const result = registry.detect('SSN: 123-45-6789');
      expect(result.signals).toContain('PII');
    });
  });
});

// ============================================================================
// EXTENDED_DOMAIN_DEFINITIONS export
// ============================================================================

describe('EXTENDED_DOMAIN_DEFINITIONS', () => {
  const expectedDomains = [
    'Healthcare',
    'Education',
    'Safety',
    'Operations',
    'CustomerService',
    'Marketing',
    'Compliance',
    'ClinicalResearch',
    'RealEstate',
    'Agriculture',
  ];

  it('has exactly 10 entries', () => {
    const keys = Object.keys(EXTENDED_DOMAIN_DEFINITIONS);
    expect(keys).toHaveLength(10);
  });

  it.each(expectedDomains)('contains "%s"', (name) => {
    expect(EXTENDED_DOMAIN_DEFINITIONS).toHaveProperty(name);
  });

  it('every definition has patterns, keywords, and exemplar fields', () => {
    for (const [name, config] of Object.entries(EXTENDED_DOMAIN_DEFINITIONS)) {
      expect(Array.isArray(config.patterns)).toBe(true);
      expect(config.patterns.length).toBeGreaterThan(0);

      expect(Array.isArray(config.keywords)).toBe(true);
      expect(config.keywords.length).toBeGreaterThan(0);

      expect(typeof config.exemplar).toBe('string');
      expect(config.exemplar.length).toBeGreaterThan(0);
    }
  });

  it('all patterns are RegExp instances', () => {
    for (const config of Object.values(EXTENDED_DOMAIN_DEFINITIONS)) {
      for (const p of config.patterns) {
        expect(p).toBeInstanceOf(RegExp);
      }
    }
  });
});

// ============================================================================
// EXTENDED_RISK_SIGNALS export
// ============================================================================

describe('EXTENDED_RISK_SIGNALS', () => {
  const expectedSignals = [
    'PHI',
    'FERPA_DATA',
    'PAYMENT_CARD',
    'MINOR_DATA',
    'TRADE_SECRET',
    'REGULATED_SUBSTANCE',
    'SAFETY_INCIDENT',
    'TENANT_DATA',
    'CAMPAIGN_FINANCE',
    'FOOD_SAFETY',
  ];

  it('has exactly 10 entries', () => {
    const keys = Object.keys(EXTENDED_RISK_SIGNALS);
    expect(keys).toHaveLength(10);
  });

  it.each(expectedSignals)('contains "%s"', (name) => {
    expect(EXTENDED_RISK_SIGNALS).toHaveProperty(name);
  });

  it('every definition has patterns, hitlMode, and localOnly fields', () => {
    for (const [name, config] of Object.entries(EXTENDED_RISK_SIGNALS)) {
      expect(Array.isArray(config.patterns)).toBe(true);
      expect(config.patterns.length).toBeGreaterThan(0);

      expect(typeof config.hitlMode).toBe('string');
      expect(['INFORM', 'DRAFT', 'ESCALATE']).toContain(config.hitlMode);

      expect(typeof config.localOnly).toBe('boolean');
    }
  });

  it('all patterns are RegExp instances', () => {
    for (const config of Object.values(EXTENDED_RISK_SIGNALS)) {
      for (const p of config.patterns) {
        expect(p).toBeInstanceOf(RegExp);
      }
    }
  });
});
