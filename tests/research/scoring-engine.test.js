const {
  SourceScorer,
  ClaimScorer,
  JobConfidenceCalculator,
  CREDIBILITY_TIERS,
} = require("../../src/research/scoring-engine");

describe("SourceScorer", () => {
  let scorer;

  beforeEach(() => {
    scorer = new SourceScorer();
  });

  describe("credibility tiers", () => {
    test("PRIMARY_SOURCE maps to 1.0", () => {
      expect(CREDIBILITY_TIERS.PRIMARY_SOURCE).toBe(1.0);
    });

    test("AUTHORITATIVE maps to 0.85", () => {
      expect(CREDIBILITY_TIERS.AUTHORITATIVE).toBe(0.85);
    });

    test("SECONDARY maps to 0.65", () => {
      expect(CREDIBILITY_TIERS.SECONDARY).toBe(0.65);
    });

    test("UNVERIFIED maps to 0.3", () => {
      expect(CREDIBILITY_TIERS.UNVERIFIED).toBe(0.3);
    });

    test("FLAGGED maps to 0.0", () => {
      expect(CREDIBILITY_TIERS.FLAGGED).toBe(0.0);
    });
  });

  describe("recency scoring", () => {
    test("published today returns ~1.0", () => {
      const score = scorer._recencyScore(new Date());
      expect(score).toBeGreaterThan(0.99);
    });

    test("published 180 days ago returns ~0.37 (e^-1)", () => {
      const d = new Date();
      d.setDate(d.getDate() - 180);
      const score = scorer._recencyScore(d);
      expect(score).toBeCloseTo(Math.exp(-1), 1);
    });

    test("published 365 days ago returns near 0", () => {
      const d = new Date();
      d.setDate(d.getDate() - 365);
      const score = scorer._recencyScore(d);
      expect(score).toBeLessThan(0.15);
    });

    test("null publishedAt defaults to 0.5", () => {
      const score = scorer._recencyScore(null);
      expect(score).toBe(0.5);
    });
  });

  describe("domain authority", () => {
    test("returns provided domainAuthority value", () => {
      const score = scorer._domainAuthority(80);
      expect(score).toBe(80);
    });

    test("defaults to 50 when not provided", () => {
      const score = scorer._domainAuthority(undefined);
      expect(score).toBe(50);
    });

    test("clamps to 0-100 range", () => {
      expect(scorer._domainAuthority(150)).toBe(100);
      expect(scorer._domainAuthority(-10)).toBe(0);
    });
  });

  describe("credibility scoring", () => {
    test("returns tier value for known tier", () => {
      expect(scorer._credibilityScore("PRIMARY_SOURCE")).toBe(1.0);
      expect(scorer._credibilityScore("AUTHORITATIVE")).toBe(0.85);
    });

    test("returns UNVERIFIED value for unknown tier", () => {
      expect(scorer._credibilityScore("UNKNOWN_TIER")).toBe(
        CREDIBILITY_TIERS.UNVERIFIED
      );
    });
  });

  describe("composite score", () => {
    test("applies correct weights: 0.25 domain + 0.20 recency + 0.35 relevance + 0.20 credibility", () => {
      const composite = scorer._composite({
        domainAuthority: 100,
        recencyScore: 1.0,
        relevanceScore: 1.0,
        credibilityScore: 1.0,
      });
      // (100/100)*0.25 + 1.0*0.20 + 1.0*0.35 + 1.0*0.20 = 1.0
      expect(composite).toBeCloseTo(1.0, 5);
    });

    test("all zeros produces 0", () => {
      const composite = scorer._composite({
        domainAuthority: 0,
        recencyScore: 0,
        relevanceScore: 0,
        credibilityScore: 0,
      });
      expect(composite).toBe(0);
    });

    test("mid-range values produce expected composite", () => {
      const composite = scorer._composite({
        domainAuthority: 50,
        recencyScore: 0.5,
        relevanceScore: 0.5,
        credibilityScore: 0.65,
      });
      // (50/100)*0.25 + 0.5*0.20 + 0.5*0.35 + 0.65*0.20
      // = 0.125 + 0.10 + 0.175 + 0.13 = 0.53
      expect(composite).toBeCloseTo(0.53, 2);
    });

    test("composite is clamped to [0, 1]", () => {
      const composite = scorer._composite({
        domainAuthority: 200,
        recencyScore: 2.0,
        relevanceScore: 2.0,
        credibilityScore: 2.0,
      });
      expect(composite).toBeLessThanOrEqual(1.0);
    });
  });

  describe("scoreSource", () => {
    test("returns full breakdown object", () => {
      const result = scorer.scoreSource({
        domainAuthority: 90,
        publishedAt: new Date(),
        relevanceScore: 0.85,
        credibilityTier: "AUTHORITATIVE",
      });

      expect(result).toHaveProperty("domainAuthority", 90);
      expect(result).toHaveProperty("recencyScore");
      expect(result).toHaveProperty("relevanceScore", 0.85);
      expect(result).toHaveProperty("credibilityScore", 0.85);
      expect(result).toHaveProperty("composite");
      expect(result.composite).toBeGreaterThan(0);
      expect(result.composite).toBeLessThanOrEqual(1);
    });

    test("uses defaults for missing fields", () => {
      const result = scorer.scoreSource({
        relevanceScore: 0.5,
      });

      expect(result.domainAuthority).toBe(50);
      expect(result.recencyScore).toBe(0.5);
      expect(result.credibilityScore).toBe(CREDIBILITY_TIERS.UNVERIFIED);
    });
  });
});

describe("ClaimScorer", () => {
  let scorer;

  beforeEach(() => {
    scorer = new ClaimScorer();
  });

  describe("support strength", () => {
    test("calculates mean composite of supporting sources", () => {
      const sources = [{ composite: 0.8 }, { composite: 0.6 }, { composite: 0.9 }];
      const strength = scorer._supportStrength(sources);
      expect(strength).toBeCloseTo((0.8 + 0.6 + 0.9) / 3, 5);
    });

    test("returns 0 for empty sources", () => {
      expect(scorer._supportStrength([])).toBe(0);
    });
  });

  describe("contradiction detection", () => {
    test("returns true when contradicting sources exist", () => {
      expect(scorer._contradictionDetected(2)).toBe(true);
    });

    test("returns false when no contradicting sources", () => {
      expect(scorer._contradictionDetected(0)).toBe(false);
    });
  });

  describe("scoreClaim", () => {
    test("high support + no contradictions = high confidence", () => {
      const result = scorer.scoreClaim({
        supportingSources: [{ composite: 0.9 }, { composite: 0.85 }],
        contradictingSources: [],
      });

      expect(result.supportStrength).toBeGreaterThan(0.8);
      expect(result.contradictionFlag).toBe(false);
      expect(result.confidenceScore).toBeGreaterThan(0.8);
    });

    test("low support + contradictions = low confidence", () => {
      const result = scorer.scoreClaim({
        supportingSources: [{ composite: 0.3 }],
        contradictingSources: [{ composite: 0.7 }, { composite: 0.6 }],
      });

      expect(result.supportStrength).toBeLessThan(0.4);
      expect(result.contradictionFlag).toBe(true);
      expect(result.confidenceScore).toBeLessThan(0.4);
    });

    test("confidence is clamped to [0, 1]", () => {
      const result = scorer.scoreClaim({
        supportingSources: [{ composite: 1.0 }, { composite: 1.0 }, { composite: 1.0 }],
        contradictingSources: [],
      });
      expect(result.confidenceScore).toBeLessThanOrEqual(1.0);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
    });

    test("contradiction penalty reduces confidence", () => {
      const withoutContra = scorer.scoreClaim({
        supportingSources: [{ composite: 0.8 }],
        contradictingSources: [],
      });
      const withContra = scorer.scoreClaim({
        supportingSources: [{ composite: 0.8 }],
        contradictingSources: [{ composite: 0.7 }],
      });
      expect(withContra.confidenceScore).toBeLessThan(withoutContra.confidenceScore);
    });
  });
});

describe("JobConfidenceCalculator", () => {
  let calc;

  beforeEach(() => {
    calc = new JobConfidenceCalculator();
  });

  describe("source count multiplier", () => {
    test("1 source = 0.1 multiplier (1/10)", () => {
      expect(calc._sourceCountMultiplier(1)).toBeCloseTo(0.1, 5);
    });

    test("5 sources = 0.5 multiplier", () => {
      expect(calc._sourceCountMultiplier(5)).toBeCloseTo(0.5, 5);
    });

    test("10+ sources = 1.0 multiplier (capped)", () => {
      expect(calc._sourceCountMultiplier(10)).toBe(1.0);
      expect(calc._sourceCountMultiplier(50)).toBe(1.0);
    });

    test("0 sources = 0 multiplier", () => {
      expect(calc._sourceCountMultiplier(0)).toBe(0);
    });
  });

  describe("calculateJobConfidence", () => {
    test("computes weighted average of claim confidence scores", () => {
      const claims = [
        { confidenceScore: 0.9 },
        { confidenceScore: 0.7 },
        { confidenceScore: 0.8 },
      ];
      const result = calc.calculateJobConfidence(claims, 10);
      expect(result.confidence).toBeCloseTo(0.8, 1);
    });

    test("applies source count multiplier", () => {
      const claims = [{ confidenceScore: 0.8 }];
      const fullSources = calc.calculateJobConfidence(claims, 10);
      const fewSources = calc.calculateJobConfidence(claims, 3);
      expect(fewSources.confidence).toBeLessThan(fullSources.confidence);
    });

    test("returns 0 for empty claim list", () => {
      const result = calc.calculateJobConfidence([], 5);
      expect(result.confidence).toBe(0);
    });

    test("final confidence is clamped to [0, 1]", () => {
      const claims = [{ confidenceScore: 1.0 }];
      const result = calc.calculateJobConfidence(claims, 100);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    test("returns structured result object", () => {
      const claims = [
        { confidenceScore: 0.9, contradictionFlag: false },
        { confidenceScore: 0.5, contradictionFlag: true },
      ];
      const result = calc.calculateJobConfidence(claims, 8);

      expect(result).toHaveProperty("confidence");
      expect(result).toHaveProperty("claimCount", 2);
      expect(result).toHaveProperty("sourceCount", 8);
      expect(result).toHaveProperty("hasContradictions", true);
    });

    test("hasContradictions is false when no claims have contradictions", () => {
      const claims = [
        { confidenceScore: 0.9, contradictionFlag: false },
      ];
      const result = calc.calculateJobConfidence(claims, 10);
      expect(result.hasContradictions).toBe(false);
    });
  });
});
