/**
 * Scoring Worker — Scores sources, extracts claims via LLM, and calculates job confidence.
 */

const { BaseWorker } = require("./base-worker");

class ScoringWorker extends BaseWorker {
  constructor(sourceScorer, claimScorer, jobConfidenceCalculator, modelRouter, opts = {}) {
    super(modelRouter, { timeoutMs: opts.timeoutMs || 90000 });
    this.sourceScorer = sourceScorer;
    this.claimScorer = claimScorer;
    this.jobConfidenceCalculator = jobConfidenceCalculator;
  }

  async execute(sources, query) {
    const scoredSources = sources.map((source) => ({
      ...source,
      ...this.sourceScorer.scoreSource(source),
    }));

    let rawClaims = [];
    try {
      const result = await this.withTimeout(
        this.router.chatCompletion({
          messages: [
            {
              role: "system",
              content: `You are a claim extraction engine. Given a research query and source evidence, identify the key factual claims made across the sources. For each claim, indicate which source indices support it and which contradict it. Return ONLY a JSON array where each element has: {"text": "claim text", "supportingIndices": [0, 1], "contradictingIndices": []}. No explanation, no markdown, just the JSON array.`,
            },
            {
              role: "user",
              content: `Query: ${query}\n\nSources:\n${scoredSources.map((s, i) => `[${i}] ${s.text}`).join("\n")}`,
            },
          ],
          temperature: 0.2,
        }),
        "Claim extraction"
      );

      const parsed = this.safeJsonParse(result.content, []);
      if (Array.isArray(parsed)) rawClaims = parsed;
    } catch {
      return {
        scoredSources,
        scoredClaims: [],
        jobConfidence: this.jobConfidenceCalculator.calculateJobConfidence([], sources.length),
      };
    }

    const scoredClaims = rawClaims.map((claim) => {
      const supportingSources = (claim.supportingIndices || [])
        .filter((i) => i >= 0 && i < scoredSources.length)
        .map((i) => scoredSources[i]);
      const contradictingSources = (claim.contradictingIndices || [])
        .filter((i) => i >= 0 && i < scoredSources.length)
        .map((i) => scoredSources[i]);

      return {
        text: claim.text,
        ...this.claimScorer.scoreClaim({ supportingSources, contradictingSources }),
      };
    });

    const jobConfidence = this.jobConfidenceCalculator.calculateJobConfidence(
      scoredClaims, sources.length
    );

    return { scoredSources, scoredClaims, jobConfidence };
  }
}

module.exports = { ScoringWorker };
