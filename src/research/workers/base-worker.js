/**
 * BaseWorker — Shared timeout, JSON parsing, and error handling for research workers.
 */

class BaseWorker {
  constructor(modelRouter, { timeoutMs = 60000 } = {}) {
    this.router = modelRouter;
    this.timeoutMs = timeoutMs;
  }

  /** Run an LLM call with a timeout. Rejects with descriptive error on timeout. */
  async withTimeout(promise, label = "LLM call") {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out`)), this.timeoutMs)
      ),
    ]);
  }

  /** Safely parse JSON, returning fallback on failure. */
  safeJsonParse(content, fallback = []) {
    try {
      return JSON.parse(content);
    } catch {
      return fallback;
    }
  }
}

module.exports = { BaseWorker };
