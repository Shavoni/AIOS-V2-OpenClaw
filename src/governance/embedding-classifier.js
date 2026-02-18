/**
 * Embedding-Enhanced Intent Classifier.
 * Uses cosine similarity against pre-computed domain exemplar embeddings.
 * Falls back to keyword-based classification when no embedder is available.
 */

const { IntentClassifier } = require('./classifier');
const { VectorStore } = require('../rag/vector-store');

const DOMAIN_EXEMPLARS = {
  Comms: 'email slack message send reply draft compose forward notification',
  Legal: 'contract legal compliance agreement terms clause liability nda regulation',
  HR: 'employee hire salary performance review onboard benefits termination',
  Finance: 'invoice payment budget expense revenue financial accounting transaction',
  DevOps: 'deploy server docker cicd pipeline infrastructure kubernetes aws',
};

class EmbeddingClassifier {
  /**
   * @param {Object|null} embedder - Embedding provider instance (or null for keyword fallback)
   */
  constructor(embedder) {
    this.embedder = embedder;
    this.keywordClassifier = new IntentClassifier();
    this.domainEmbeddings = {};
    this.domainNames = Object.keys(DOMAIN_EXEMPLARS);
    this.initialized = false;
  }

  /**
   * Pre-compute domain exemplar embeddings.
   * Must be called once after construction if embedder is available.
   */
  async initialize() {
    if (!this.embedder) return;

    const texts = this.domainNames.map(d => DOMAIN_EXEMPLARS[d]);
    const embeddings = await this.embedder.embedBatch(texts);

    if (embeddings) {
      for (let i = 0; i < this.domainNames.length; i++) {
        if (embeddings[i]) {
          this.domainEmbeddings[this.domainNames[i]] = embeddings[i];
        }
      }
      this.initialized = true;
    }
  }

  /**
   * Classify text into a domain.
   * @param {string} text
   * @returns {Promise<{domain: string, confidence: number, allScores: Object}>}
   */
  async classify(text) {
    // If no embedder or not initialized, fall back to keyword
    if (!this.embedder || !this.initialized) {
      return this.keywordClassifier.classify(text);
    }

    const queryEmbedding = await this.embedder.embed(text);

    // If embed fails, fall back to keyword
    if (!queryEmbedding) {
      return this.keywordClassifier.classify(text);
    }

    // Compute cosine similarity against each domain exemplar
    const allScores = {};
    let bestDomain = 'General';
    let bestScore = 0;

    for (const [domain, exemplarEmbedding] of Object.entries(this.domainEmbeddings)) {
      const score = VectorStore.cosineSimilarity(queryEmbedding, exemplarEmbedding);
      allScores[domain] = Math.max(0, score);

      if (score > bestScore) {
        bestScore = score;
        bestDomain = domain;
      }
    }

    allScores.General = 0;

    // If best score is too low, classify as General
    if (bestScore < 0.3) {
      bestDomain = 'General';
    }

    return {
      domain: bestDomain,
      confidence: Math.min(bestScore, 1),
      allScores,
    };
  }
}

module.exports = { EmbeddingClassifier };
