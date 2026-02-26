/**
 * Synthesis Worker — Generates structured research report from curated evidence via LLM.
 */

const { BaseWorker } = require("./base-worker");

class SynthesisWorker extends BaseWorker {
  constructor(modelRouter, opts = {}) {
    super(modelRouter, { timeoutMs: opts.timeoutMs || 120000 });
  }

  async execute({ query, scoredSources, scoredClaims, jobConfidence }) {
    try {
      const sourceCitations = scoredSources
        .map((s, i) => {
          const parts = [`[${i + 1}]`];
          if (s.title) parts.push(s.title);
          if (s.url) parts.push(s.url);
          parts.push(`(score: ${(s.composite || 0).toFixed(2)})`);
          return parts.join(" ");
        })
        .join("\n");

      const claimsBlock = scoredClaims
        .map((c) => {
          let line = `- ${c.text} (confidence: ${(c.confidenceScore || 0).toFixed(2)})`;
          if (c.contradictionFlag) line += " [CONTRADICTION DETECTED]";
          return line;
        })
        .join("\n");

      const confidencePercent = Math.round((jobConfidence.confidence || 0) * 100);
      const contradictionNote = jobConfidence.hasContradictions
        ? "\nIMPORTANT: Contradictions were detected among sources. Address these contradictions explicitly in the report."
        : "";

      const systemPrompt = `You are a research synthesis engine. Generate a comprehensive, well-structured research report based on the provided evidence. Use markdown formatting with headers, bullet points, and citations.

Research Query: ${query}

Sources (${jobConfidence.sourceCount || 0} total):
${sourceCitations || "No sources available."}

Key Claims:
${claimsBlock || "No claims extracted."}

Overall Confidence: ${confidencePercent}%${contradictionNote}

Guidelines:
- Cite sources using [N] notation
- Structure with clear sections: Summary, Key Findings, Analysis, Limitations
- Be transparent about confidence levels and evidence gaps
- If contradictions exist, present both sides fairly`;

      const result = await this.withTimeout(
        this.router.route(
          [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Generate a comprehensive research report for: ${query}` },
          ],
          { temperature: 0.4 }
        ),
        "Synthesis"
      );

      return { synthesis: result.text, tokenUsage: result.usage || {} };
    } catch (error) {
      return { synthesis: `Synthesis failed: ${error.message}`, error: error.message, tokenUsage: {} };
    }
  }
}

module.exports = { SynthesisWorker };
