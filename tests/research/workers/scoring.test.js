const { ScoringWorker } = require("../../../src/research/workers/scoring");
const { SourceScorer, ClaimScorer, JobConfidenceCalculator } = require("../../../src/research/scoring-engine");

describe("ScoringWorker", () => {
  let worker, mockRouter;

  beforeEach(() => {
    mockRouter = {
      chatCompletion: jest.fn(),
    };
    worker = new ScoringWorker(
      new SourceScorer(),
      new ClaimScorer(),
      new JobConfidenceCalculator(),
      mockRouter
    );
  });

  test("scores each source using SourceScorer", async () => {
    mockRouter.chatCompletion.mockResolvedValue({
      content: JSON.stringify([{ text: "Claim 1", supportingIndices: [0] }]),
    });

    const sources = [
      { text: "Source text", url: "https://nature.com", publishedAt: new Date().toISOString(), relevanceScore: 0.9, credibilityTier: "PRIMARY_SOURCE", domainAuthority: 95 },
    ];

    const result = await worker.execute(sources, "test query");
    expect(result.scoredSources).toBeDefined();
    expect(result.scoredSources[0]).toHaveProperty("composite");
    expect(result.scoredSources[0].composite).toBeGreaterThan(0);
  });

  test("identifies claims from evidence via LLM", async () => {
    mockRouter.chatCompletion.mockResolvedValue({
      content: JSON.stringify([
        { text: "Quantum computers use qubits", supportingIndices: [0], contradictingIndices: [] },
        { text: "Qubits leverage superposition", supportingIndices: [0], contradictingIndices: [] },
      ]),
    });

    const sources = [
      { text: "Source about qubits", url: "https://x.com", relevanceScore: 0.8 },
    ];

    const result = await worker.execute(sources, "quantum computing");
    expect(result.scoredClaims.length).toBe(2);
  });

  test("scores each claim using ClaimScorer", async () => {
    mockRouter.chatCompletion.mockResolvedValue({
      content: JSON.stringify([
        { text: "Claim A", supportingIndices: [0, 1], contradictingIndices: [] },
      ]),
    });

    const sources = [
      { text: "S1", url: "https://a.com", relevanceScore: 0.9, credibilityTier: "PRIMARY_SOURCE", domainAuthority: 90 },
      { text: "S2", url: "https://b.com", relevanceScore: 0.7, credibilityTier: "AUTHORITATIVE", domainAuthority: 80 },
    ];

    const result = await worker.execute(sources, "test");
    expect(result.scoredClaims[0]).toHaveProperty("supportStrength");
    expect(result.scoredClaims[0]).toHaveProperty("contradictionFlag");
    expect(result.scoredClaims[0]).toHaveProperty("confidenceScore");
  });

  test("detects contradictions between sources", async () => {
    mockRouter.chatCompletion.mockResolvedValue({
      content: JSON.stringify([
        { text: "Disputed claim", supportingIndices: [0], contradictingIndices: [1] },
      ]),
    });

    const sources = [
      { text: "For", url: "https://a.com", relevanceScore: 0.8 },
      { text: "Against", url: "https://b.com", relevanceScore: 0.7 },
    ];

    const result = await worker.execute(sources, "test");
    expect(result.scoredClaims[0].contradictionFlag).toBe(true);
  });

  test("calculates job-level confidence via JobConfidenceCalculator", async () => {
    mockRouter.chatCompletion.mockResolvedValue({
      content: JSON.stringify([
        { text: "Claim", supportingIndices: [0], contradictingIndices: [] },
      ]),
    });

    const sources = Array.from({ length: 10 }, (_, i) => ({
      text: `Source ${i}`, url: `https://s${i}.com`, relevanceScore: 0.8,
      credibilityTier: "AUTHORITATIVE", domainAuthority: 80,
    }));

    const result = await worker.execute(sources, "test");
    expect(result.jobConfidence).toHaveProperty("confidence");
    expect(result.jobConfidence).toHaveProperty("claimCount");
    expect(result.jobConfidence).toHaveProperty("sourceCount");
    expect(result.jobConfidence.sourceCount).toBe(10);
  });

  test("returns structured result", async () => {
    mockRouter.chatCompletion.mockResolvedValue({
      content: JSON.stringify([
        { text: "Claim", supportingIndices: [0], contradictingIndices: [] },
      ]),
    });

    const result = await worker.execute(
      [{ text: "S", url: "https://x.com", relevanceScore: 0.5 }],
      "query"
    );

    expect(result).toHaveProperty("scoredSources");
    expect(result).toHaveProperty("scoredClaims");
    expect(result).toHaveProperty("jobConfidence");
  });

  test("handles LLM failure for claim extraction gracefully", async () => {
    mockRouter.chatCompletion.mockRejectedValue(new Error("LLM timeout"));

    const result = await worker.execute(
      [{ text: "S", url: "https://x.com", relevanceScore: 0.5 }],
      "query"
    );

    expect(result.scoredClaims).toEqual([]);
    expect(result.jobConfidence.confidence).toBe(0);
  });
});
