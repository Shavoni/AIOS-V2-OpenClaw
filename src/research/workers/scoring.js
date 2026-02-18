/**
 * Scoring Worker — Scores sources, extracts claims via LLM, and calculates job confidence.
 */

const DEFAULT_TIMEOUT_MS = 90000;

class ScoringWorker {
  constructor(sourceScorer, claimScorer, jobConfidenceCalculator, modelRouter, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    this.sourceScorer = sourceScorer;
    this.claimScorer = claimScorer;
    this.jobConfidenceCalculator = jobConfidenceCalculator;
    this.router = modelRouter;
    this.timeoutMs = timeoutMs;
  }

  async execute(sources, query) {
    // Score each source
    const scoredSources = sources.map((source) => ({
      ...source,
      ...this.sourceScorer.scoreSource(source),
    }));

    // Extract claims via LLM
    let rawClaims = [];
    try {
      const result = await Promise.race([
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
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Claim extraction timed out")), this.timeoutMs)
        ),
      ]);

      const parsed = JSON.parse(result.content);
      if (Array.isArray(parsed)) {
        rawClaims = parsed;
      }
    } catch {
      // LLM failure — return scored sources with empty claims and zero confidence
      return {
        scoredSources,
        scoredClaims: [],
        jobConfidence: this.jobConfidenceCalculator.calculateJobConfidence([], sources.length),
      };
    }

    // Score each claim
    const scoredClaims = rawClaims.map((claim) => {
      const supportingSources = (claim.supportingIndices || [])
        .filter((i) => i >= 0 && i < scoredSources.length)
        .map((i) => scoredSources[i]);

      const contradictingSources = (claim.contradictingIndices || [])
        .filter((i) => i >= 0 && i < scoredSources.length)
        .map((i) => scoredSources[i]);

      const scores = this.claimScorer.scoreClaim({
        supportingSources,
        contradictingSources,
      });

      return {
        text: claim.text,
        ...scores,
      };
    });

    // Calculate job-level confidence
    const jobConfidence = this.jobConfidenceCalculator.calculateJobConfidence(
      scoredClaims,
      sources.length
    );

    return {
      scoredSources,
      scoredClaims,
      jobConfidence,
    };
  }
}

module.exports = { ScoringWorker };
