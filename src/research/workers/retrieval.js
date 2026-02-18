/**
 * Retrieval Worker — Hybrid RAG + web retrieval with Reciprocal Rank Fusion.
 */

const TAVILY_API_URL = "https://api.tavily.com/search";

class RetrievalWorker {
  constructor(ragPipeline, { tavilyApiKey } = {}) {
    this.rag = ragPipeline;
    this.tavilyApiKey = tavilyApiKey || null;
  }

  async execute(subQuestions, agentId) {
    const ragResults = await this._ragRetrieveAll(subQuestions, agentId);
    const webResults = await this._webRetrieveAll(subQuestions);

    // Tag sources with retrieval method
    ragResults.forEach((r) => { r.retrievalMethod = "rag"; });
    webResults.forEach((r) => { r.retrievalMethod = "web"; });

    // Merge via RRF if we have both
    const resultSets = [];
    if (ragResults.length > 0) resultSets.push(ragResults);
    if (webResults.length > 0) resultSets.push(webResults);

    if (resultSets.length === 0) return [];

    const fused = this._reciprocalRankFusion(resultSets);

    // Deduplicate by text content
    const seen = new Set();
    return fused.filter((r) => {
      const key = r.text.slice(0, 100);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async _ragRetrieveAll(subQuestions, agentId) {
    const allResults = [];
    for (const q of subQuestions) {
      try {
        const results = this.rag.search.search(agentId, q, 5);
        for (const r of results) {
          allResults.push({
            id: `rag-${allResults.length}`,
            text: r.text,
            metadata: r.metadata || {},
            score: r.score || 0,
            retrievalMethod: "rag",
          });
        }
      } catch {
        // RAG failure for this query, continue
      }
    }
    return allResults;
  }

  async _webRetrieveAll(subQuestions) {
    if (!this.tavilyApiKey) return [];

    const allResults = [];
    // Use first 3 sub-questions for web search to avoid excessive API calls
    const queries = subQuestions.slice(0, 3);

    for (const q of queries) {
      try {
        const res = await fetch(TAVILY_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: this.tavilyApiKey,
            query: q,
            search_depth: "advanced",
            max_results: 5,
          }),
        });

        if (!res.ok) continue;
        const data = await res.json();

        for (const r of data.results || []) {
          allResults.push({
            id: `web-${allResults.length}`,
            text: r.content || "",
            url: r.url,
            title: r.title || "",
            score: r.score || 0,
            retrievalMethod: "web",
          });
        }
      } catch {
        // Web retrieval failure, continue
      }
    }
    return allResults;
  }

  /**
   * Reciprocal Rank Fusion — merges multiple ranked lists.
   * RRF_score(d) = sum(1 / (k + rank(d))) where k=60
   */
  _reciprocalRankFusion(resultSets, k = 60) {
    const scores = new Map();
    const items = new Map();

    for (const resultSet of resultSets) {
      for (let rank = 0; rank < resultSet.length; rank++) {
        const item = resultSet[rank];
        const id = item.id || item.text.slice(0, 80);
        const rrfScore = 1 / (k + rank + 1);

        scores.set(id, (scores.get(id) || 0) + rrfScore);
        if (!items.has(id)) {
          items.set(id, item);
        }
      }
    }

    return Array.from(scores.entries())
      .map(([id, rrfScore]) => ({
        ...items.get(id),
        rrfScore,
      }))
      .sort((a, b) => b.rrfScore - a.rrfScore);
  }
}

module.exports = { RetrievalWorker };
