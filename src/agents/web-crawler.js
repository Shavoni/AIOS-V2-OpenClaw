/**
 * WebCrawler — Fetches and parses web content for agent knowledge bases.
 * Extracts clean text from URLs, integrates with RAG pipeline for indexing.
 * Supports automatic refresh of stale web sources.
 */

const cheerio = require("cheerio");

class WebCrawler {
  /**
   * @param {Object} [options]
   * @param {number} [options.timeoutMs] - Fetch timeout in milliseconds (default 15000)
   * @param {string} [options.userAgent] - User-Agent header
   */
  constructor(options = {}) {
    this.timeoutMs = options.timeoutMs || 15000;
    this.userAgent = options.userAgent || "AIOS-V2-WebCrawler/1.0";
  }

  /**
   * Fetch a URL and extract clean text content.
   * @param {string} url
   * @param {Object} [options]
   * @param {number} [options.maxContentLength] - Truncate content to this length
   * @returns {Promise<{ ok: boolean, url: string, text: string, title?: string, error?: string }>}
   */
  async fetchAndParse(url, options = {}) {
    const result = { ok: false, url: url || "", text: "", title: "" };

    // Validate URL
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      result.error = "Invalid URL";
      return result;
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      result.error = `Unsupported protocol: ${parsedUrl.protocol}`;
      return result;
    }

    try {
      const response = await fetch(url, {
        headers: { "User-Agent": this.userAgent },
        signal: AbortSignal.timeout ? AbortSignal.timeout(this.timeoutMs) : undefined,
      });

      if (!response.ok) {
        result.error = `HTTP ${response.status} ${response.statusText || ""}`.trim();
        return result;
      }

      const rawText = await response.text();
      const contentType = this._getContentType(response);

      if (contentType.includes("json")) {
        result.text = this._parseJSON(rawText);
      } else if (contentType.includes("html")) {
        const parsed = this._parseHTML(rawText);
        result.text = parsed.text;
        result.title = parsed.title;
      } else {
        // Plain text and other text types
        result.text = rawText;
      }

      // Apply content length limit
      if (options.maxContentLength && result.text.length > options.maxContentLength) {
        result.text = result.text.slice(0, options.maxContentLength);
      }

      result.ok = true;
    } catch (err) {
      result.error = err.message;
    }

    return result;
  }

  /**
   * Refresh a single web source — fetch content, index into RAG, update timestamp.
   * @param {Object} source - Web source record { id, agent_id, url, name }
   * @param {Object} deps - { rag: RAGPipeline, agentManager: AgentManagerService }
   * @returns {Promise<{ ok: boolean, chunksIndexed?: number, error?: string }>}
   */
  async refreshWebSource(source, { rag, agentManager }) {
    const fetchResult = await this.fetchAndParse(source.url);

    if (!fetchResult.ok) {
      return { ok: false, error: fetchResult.error };
    }

    // Remove old indexed content for this web source
    const docId = `web-source-${source.id}`;
    try { rag.removeDocument(source.agent_id, docId); } catch { /* ok if not indexed */ }

    // Index the fresh content
    const chunks = rag.indexDocument(source.agent_id, docId, fetchResult.text, {
      filename: fetchResult.title || source.name || source.url,
      file_type: "html",
      source: "web_crawl",
      source_url: source.url,
    });

    // Update last_refreshed timestamp
    const now = new Date().toISOString();
    agentManager.updateWebSource(source.id, {
      last_refreshed: now,
      chunk_count: typeof chunks === "number" ? chunks : 0,
    });

    return {
      ok: true,
      chunksIndexed: typeof chunks === "number" ? chunks : 0,
    };
  }

  /**
   * Refresh all stale web sources (past their refresh interval).
   * @param {Array} sources - All web source records
   * @param {Object} deps - { rag, agentManager }
   * @returns {Promise<{ refreshed: number, skipped: number, errors: number }>}
   */
  async refreshAllStale(sources, deps) {
    const stats = { refreshed: 0, skipped: 0, errors: 0 };
    const now = Date.now();

    for (const source of sources) {
      // Skip if auto_refresh is disabled
      if (!source.auto_refresh) {
        stats.skipped++;
        continue;
      }

      // Check if refresh is needed based on interval
      const intervalMs = (source.refresh_interval_hours || 24) * 60 * 60 * 1000;
      const lastRefreshed = source.last_refreshed ? new Date(source.last_refreshed).getTime() : 0;

      if (now - lastRefreshed < intervalMs) {
        stats.skipped++;
        continue;
      }

      // Refresh this source
      const result = await this.refreshWebSource(source, deps);
      if (result.ok) {
        stats.refreshed++;
      } else {
        stats.errors++;
      }
    }

    return stats;
  }

  /**
   * Extract content type from response headers.
   * @private
   */
  _getContentType(response) {
    if (response.headers instanceof Map) {
      return (response.headers.get("content-type") || "").toLowerCase();
    }
    if (typeof response.headers?.get === "function") {
      return (response.headers.get("content-type") || "").toLowerCase();
    }
    return "";
  }

  /**
   * Parse HTML content — strip non-content elements, extract text.
   * @private
   */
  _parseHTML(html) {
    const $ = cheerio.load(html);
    const title = $("title").text().trim();

    // Remove non-content elements
    $("script, style, nav, header, footer, noscript, iframe, svg, [role='navigation']").remove();

    const body = $("body").length ? $("body") : $.root();
    const text = body.text().replace(/\s+/g, " ").trim();

    return { text, title };
  }

  /**
   * Parse JSON content to readable text.
   * @private
   */
  _parseJSON(raw) {
    try {
      const data = JSON.parse(raw);
      return JSON.stringify(data, null, 2);
    } catch {
      return raw;
    }
  }
}

module.exports = { WebCrawler };
