/**
 * TDD RED → GREEN: Embedding-Enhanced Intent Classification
 */

const { EmbeddingClassifier } = require('../../src/governance/embedding-classifier');

describe('EmbeddingClassifier', () => {
  it('pre-computes domain exemplar embeddings on construction', async () => {
    const mockEmbedder = {
      embedBatch: jest.fn().mockResolvedValue([
        new Float32Array([1, 0, 0]),
        new Float32Array([0, 1, 0]),
        new Float32Array([0, 0, 1]),
        new Float32Array([0.5, 0.5, 0]),
        new Float32Array([0.3, 0.3, 0.4]),
      ]),
    };

    const classifier = new EmbeddingClassifier(mockEmbedder);
    await classifier.initialize();

    expect(mockEmbedder.embedBatch).toHaveBeenCalled();
    expect(classifier.initialized).toBe(true);
  });

  it('classifies text using cosine similarity against domain exemplars', async () => {
    // Create mock embedder that returns specific vectors for domains
    const domainVectors = {
      'email slack message': new Float32Array([1, 0, 0, 0, 0]),
      'contract legal compliance': new Float32Array([0, 1, 0, 0, 0]),
      'employee salary hire': new Float32Array([0, 0, 1, 0, 0]),
      'invoice payment budget': new Float32Array([0, 0, 0, 1, 0]),
      'deploy server docker': new Float32Array([0, 0, 0, 0, 1]),
    };

    const mockEmbedder = {
      embedBatch: jest.fn().mockResolvedValue(Object.values(domainVectors)),
      embed: jest.fn().mockResolvedValue(new Float32Array([0.9, 0.1, 0, 0, 0])),  // Close to Comms
    };

    const classifier = new EmbeddingClassifier(mockEmbedder);
    await classifier.initialize();

    const result = await classifier.classify('send an email to the team');

    expect(result.domain).toBe('Comms');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.allScores).toBeDefined();
    expect(typeof result.allScores).toBe('object');
  });

  it('returns result with domain, confidence, and allScores', async () => {
    const mockEmbedder = {
      embedBatch: jest.fn().mockResolvedValue([
        new Float32Array([1, 0, 0]),
        new Float32Array([0, 1, 0]),
        new Float32Array([0, 0, 1]),
        new Float32Array([0.5, 0.5, 0]),
        new Float32Array([0.3, 0.3, 0.4]),
      ]),
      embed: jest.fn().mockResolvedValue(new Float32Array([0, 0, 1])),
    };

    const classifier = new EmbeddingClassifier(mockEmbedder);
    await classifier.initialize();

    const result = await classifier.classify('hire a new employee');
    expect(result).toHaveProperty('domain');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('allScores');
    expect(typeof result.confidence).toBe('number');
  });

  it('falls back to keyword classifier when no embedder provided', async () => {
    const classifier = new EmbeddingClassifier(null);

    // Should still work without initialization
    const result = await classifier.classify('send an email to the team');
    expect(result.domain).toBe('Comms');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.allScores).toBeDefined();
  });

  it('falls back to keyword classifier when embed returns null', async () => {
    const mockEmbedder = {
      embedBatch: jest.fn().mockResolvedValue([
        new Float32Array([1, 0, 0]),
        new Float32Array([0, 1, 0]),
        new Float32Array([0, 0, 1]),
        new Float32Array([0.5, 0.5, 0]),
        new Float32Array([0.3, 0.3, 0.4]),
      ]),
      embed: jest.fn().mockResolvedValue(null),
    };

    const classifier = new EmbeddingClassifier(mockEmbedder);
    await classifier.initialize();

    const result = await classifier.classify('send an email to the team');
    // Should fall back to keyword and still classify
    expect(result.domain).toBe('Comms');
    expect(result.allScores).toBeDefined();
  });

  it('classify returns General for ambiguous input', async () => {
    const classifier = new EmbeddingClassifier(null);
    const result = await classifier.classify('hello world');
    expect(result.domain).toBe('General');
  });
});
