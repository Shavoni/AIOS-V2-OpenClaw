/**
 * Deep Research Pipeline — Scoring Engine
 *
 * Pure logic classes for source, claim, and job-level confidence scoring.
 * No external dependencies. All methods are deterministic.
 */

const CREDIBILITY_TIERS = Object.freeze({
  PRIMARY_SOURCE: 1.0,
  AUTHORITATIVE: 0.85,
  SECONDARY: 0.65,
  UNVERIFIED: 0.3,
  FLAGGED: 0.0,
});

const WEIGHTS = Object.freeze({
  domainAuthority: 0.25,
  recencyScore: 0.2,
  relevanceScore: 0.35,
  credibilityScore: 0.2,
});

class SourceScorer {
  /**
   * Score a single source with composite breakdown.
   * @param {Object} source
   * @param {number} [source.domainAuthority] - 0-100, defaults to 50
   * @param {Date|string|null} [source.publishedAt] - Publication date
   * @param {number} [source.relevanceScore] - 0-1, cosine similarity
   * @param {string} [source.credibilityTier] - CREDIBILITY_TIERS key
   * @returns {{ domainAuthority: number, recencyScore: number, relevanceScore: number, credibilityScore: number, composite: number }}
   */
  scoreSource({
    domainAuthority,
    publishedAt,
    relevanceScore = 0,
    credibilityTier,
  } = {}) {
    const da = this._domainAuthority(domainAuthority);
    const rec = this._recencyScore(publishedAt);
    const rel = relevanceScore;
    const cred = this._credibilityScore(credibilityTier);

    const composite = this._composite({
      domainAuthority: da,
      recencyScore: rec,
      relevanceScore: rel,
      credibilityScore: cred,
    });

    return {
      domainAuthority: da,
      recencyScore: rec,
      relevanceScore: rel,
      credibilityScore: cred,
      composite,
    };
  }

  /**
   * Normalize domain authority to 0-100.
   */
  _domainAuthority(value) {
    if (value == null) return 50;
    return Math.max(0, Math.min(100, value));
  }

  /**
   * Exponential decay based on days since publication.
   * Half-life at ~125 days, reaches ~0.37 at 180 days.
   * Returns 0.5 for unknown dates.
   */
  _recencyScore(publishedAt) {
    if (!publishedAt) return 0.5;
    const date = publishedAt instanceof Date ? publishedAt : new Date(publishedAt);
    if (isNaN(date.getTime())) return 0.5;

    const daysSince = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
    return Math.exp(-daysSince / 180);
  }

  /**
   * Map credibility tier string to numeric score.
   */
  _credibilityScore(tier) {
    if (tier && tier in CREDIBILITY_TIERS) {
      return CREDIBILITY_TIERS[tier];
    }
    return CREDIBILITY_TIERS.UNVERIFIED;
  }

  /**
   * Weighted composite score, clamped to [0, 1].
   */
  _composite({ domainAuthority, recencyScore, relevanceScore, credibilityScore }) {
    const raw =
      (domainAuthority / 100) * WEIGHTS.domainAuthority +
      recencyScore * WEIGHTS.recencyScore +
      relevanceScore * WEIGHTS.relevanceScore +
      credibilityScore * WEIGHTS.credibilityScore;

    return Math.max(0, Math.min(1, raw));
  }
}

class ClaimScorer {
  /**
   * Score a single claim based on supporting and contradicting sources.
   * @param {Object} claim
   * @param {Array<{composite: number}>} claim.supportingSources
   * @param {Array<{composite: number}>} claim.contradictingSources
   * @returns {{ supportStrength: number, contradictionFlag: boolean, confidenceScore: number }}
   */
  scoreClaim({ supportingSources = [], contradictingSources = [] }) {
    const supportStrength = this._supportStrength(supportingSources);
    const contradictionFlag = this._contradictionDetected(contradictingSources.length);
    const contradictionPenalty = contradictingSources.length * 0.15;

    const baseConfidence = Math.min(
      supportStrength + supportingSources.length * 0.05,
      1.0
    );
    const confidenceScore = Math.max(0, Math.min(1, baseConfidence - contradictionPenalty));

    return { supportStrength, contradictionFlag, confidenceScore };
  }

  /**
   * Mean composite score of supporting sources.
   */
  _supportStrength(sources) {
    if (!sources.length) return 0;
    const sum = sources.reduce((acc, s) => acc + s.composite, 0);
    return sum / sources.length;
  }

  /**
   * Whether contradicting sources exist.
   */
  _contradictionDetected(count) {
    return count > 0;
  }
}

class JobConfidenceCalculator {
  /**
   * Calculate overall job confidence from claim scores and source count.
   * @param {Array<{confidenceScore: number, contradictionFlag?: boolean}>} claims
   * @param {number} sourceCount
   * @returns {{ confidence: number, claimCount: number, sourceCount: number, hasContradictions: boolean }}
   */
  calculateJobConfidence(claims, sourceCount) {
    if (!claims.length) {
      return {
        confidence: 0,
        claimCount: 0,
        sourceCount,
        hasContradictions: false,
      };
    }

    const avgConfidence =
      claims.reduce((sum, c) => sum + c.confidenceScore, 0) / claims.length;
    const multiplier = this._sourceCountMultiplier(sourceCount);
    const confidence = Math.max(0, Math.min(1, avgConfidence * multiplier));
    const hasContradictions = claims.some((c) => c.contradictionFlag === true);

    return {
      confidence,
      claimCount: claims.length,
      sourceCount,
      hasContradictions,
    };
  }

  /**
   * Linear multiplier: 0 at 0 sources, 1.0 at 10+ sources.
   * Formula: min(sourceCount / 10, 1.0)
   */
  _sourceCountMultiplier(count) {
    return Math.min(count / 10, 1.0);
  }
}

module.exports = {
  SourceScorer,
  ClaimScorer,
  JobConfidenceCalculator,
  CREDIBILITY_TIERS,
  WEIGHTS,
};
