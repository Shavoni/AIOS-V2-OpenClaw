/**
 * Decomposition Worker — Breaks a query into targeted sub-questions via LLM.
 */

class DecompositionWorker {
  constructor(modelRouter) {
    this.router = modelRouter;
  }

  async execute(query) {
    try {
      const result = await this.router.chatCompletion({
        messages: [
          {
            role: "system",
            content: `You are a research query decomposer. Given a user query, break it into 3-7 targeted sub-questions that together would fully answer the original query. Return ONLY a JSON array of strings. No explanation, no markdown, just the JSON array.`,
          },
          { role: "user", content: query },
        ],
        temperature: 0.3,
      });

      const parsed = JSON.parse(result.content);
      if (!Array.isArray(parsed)) return [query];

      // Clean: strip numbered prefixes, deduplicate, cap at 7
      const cleaned = parsed
        .map((q) => String(q).replace(/^\d+\.\s*/, "").trim())
        .filter((q) => q.length > 0);

      const unique = [...new Set(cleaned)];
      const capped = unique.slice(0, 7);

      // Prepend original query, deduplicate again, cap at 8
      const withOriginal = [query, ...capped.filter((q) => q !== query)];
      return withOriginal.slice(0, 8);
    } catch {
      return [query];
    }
  }
}

module.exports = { DecompositionWorker };
