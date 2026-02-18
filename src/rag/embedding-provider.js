/**
 * Embedding Provider Interface for RAG pipeline.
 * Supports OpenAI and Ollama embedding APIs.
 * Uses global.fetch (Node 18+ built-in).
 */

class OpenAIEmbedder {
  /**
   * @param {Object} config
   * @param {string} config.apiKey - OpenAI API key
   * @param {string} [config.model='text-embedding-3-small'] - Embedding model
   * @param {string} [config.baseUrl='https://api.openai.com/v1'] - API base URL
   * @param {number} [config.dimensions=1536] - Embedding dimensions
   */
  constructor(config) {
    this.apiKey = config.apiKey;
    this.model = config.model || "text-embedding-3-small";
    this.baseUrl = config.baseUrl || "https://api.openai.com/v1";
    this.dimensions = config.dimensions || 1536;
  }

  /**
   * Embed a single text string.
   * @param {string} text
   * @returns {Promise<Float32Array|null>} Embedding vector or null on failure
   */
  async embed(text) {
    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          input: text,
          model: this.model,
        }),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return new Float32Array(data.data[0].embedding);
    } catch (_err) {
      return null;
    }
  }

  /**
   * Embed a batch of texts in a single API call.
   * @param {string[]} texts
   * @returns {Promise<Float32Array[]|null>} Array of embeddings or null on failure
   */
  async embedBatch(texts) {
    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          input: texts,
          model: this.model,
        }),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.data.map((item) => new Float32Array(item.embedding));
    } catch (_err) {
      return null;
    }
  }
}

class OllamaEmbedder {
  /**
   * @param {Object} config
   * @param {string} [config.model='nomic-embed-text'] - Ollama model name
   * @param {string} [config.baseUrl='http://localhost:11434'] - Ollama server URL
   */
  constructor(config) {
    this.model = config.model || "nomic-embed-text";
    this.baseUrl = config.baseUrl || "http://localhost:11434";
  }

  /**
   * Embed a single text string.
   * @param {string} text
   * @returns {Promise<Float32Array|null>} Embedding vector or null on failure
   */
  async embed(text) {
    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: text,
          model: this.model,
        }),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return new Float32Array(data.embedding);
    } catch (_err) {
      return null;
    }
  }

  /**
   * Embed a batch of texts sequentially (Ollama has no native batch API).
   * @param {string[]} texts
   * @returns {Promise<(Float32Array|null)[]>} Array of embeddings (null for failures)
   */
  async embedBatch(texts) {
    const results = [];
    for (const text of texts) {
      const embedding = await this.embed(text);
      results.push(embedding);
    }
    return results;
  }
}

/**
 * Factory function to create an embedding provider.
 * @param {Object|null} config
 * @param {string} config.type - 'openai' or 'ollama'
 * @returns {OpenAIEmbedder|OllamaEmbedder|null}
 */
function createEmbeddingProvider(config) {
  if (!config) return null;
  if (config.type === "openai") return new OpenAIEmbedder(config);
  if (config.type === "ollama") return new OllamaEmbedder(config);
  return null;
}

module.exports = { OpenAIEmbedder, OllamaEmbedder, createEmbeddingProvider };
