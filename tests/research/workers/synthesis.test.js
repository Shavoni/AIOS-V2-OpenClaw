const { SynthesisWorker } = require("../../../src/research/workers/synthesis");
const { createMockRouter } = require("../../fixtures/research-mocks");

describe("SynthesisWorker", () => {
  let worker, mockRouter;

  beforeEach(() => {
    mockRouter = createMockRouter();
    worker = new SynthesisWorker(mockRouter);
  });

  test("passes curated evidence set to LLM with structured prompt", async () => {
    mockRouter.route.mockResolvedValue({
      text: "# Research Report\n\nQuantum computing uses qubits...",
      usage: { promptTokens: 1000, completionTokens: 500, totalTokens: 1500 },
    });

    await worker.execute({
      query: "Explain quantum computing",
      scoredSources: [
        { text: "Source 1", url: "https://a.com", composite: 0.9 },
      ],
      scoredClaims: [
        { text: "Qubits use superposition", confidenceScore: 0.85 },
      ],
      jobConfidence: { confidence: 0.85, claimCount: 1, sourceCount: 5, hasContradictions: false },
    });

    const messages = mockRouter.route.mock.calls[0][0];
    expect(messages).toBeDefined();
    expect(messages.some((m) => m.content.includes("quantum computing"))).toBe(true);
  });

  test("structured prompt includes source citations", async () => {
    mockRouter.route.mockResolvedValue({
      text: "Report...",
      usage: { totalTokens: 100 },
    });

    await worker.execute({
      query: "test",
      scoredSources: [
        { text: "Source text", url: "https://nature.com/article", composite: 0.9, title: "Nature Article" },
      ],
      scoredClaims: [],
      jobConfidence: { confidence: 0.5, claimCount: 0, sourceCount: 1, hasContradictions: false },
    });

    const messages = mockRouter.route.mock.calls[0][0];
    const systemMsg = messages.find((m) => m.role === "system");
    expect(systemMsg.content).toContain("https://nature.com/article");
  });

  test("includes confidence level in synthesis prompt", async () => {
    mockRouter.route.mockResolvedValue({
      text: "Report...",
      usage: { totalTokens: 100 },
    });

    await worker.execute({
      query: "test",
      scoredSources: [],
      scoredClaims: [],
      jobConfidence: { confidence: 0.92, claimCount: 3, sourceCount: 10, hasContradictions: false },
    });

    const messages = mockRouter.route.mock.calls[0][0];
    const content = messages.map((m) => m.content).join(" ");
    expect(content).toContain("92");
  });

  test("flags contradictions in synthesis prompt", async () => {
    mockRouter.route.mockResolvedValue({
      text: "Report...",
      usage: { totalTokens: 100 },
    });

    await worker.execute({
      query: "test",
      scoredSources: [],
      scoredClaims: [
        { text: "Claim A", confidenceScore: 0.8, contradictionFlag: true },
      ],
      jobConfidence: { confidence: 0.6, claimCount: 1, sourceCount: 5, hasContradictions: true },
    });

    const messages = mockRouter.route.mock.calls[0][0];
    const content = messages.map((m) => m.content).join(" ");
    expect(content.toLowerCase()).toContain("contradiction");
  });

  test("returns synthesis text and token usage", async () => {
    mockRouter.route.mockResolvedValue({
      text: "# Full Research Report\n\nDetailed findings...",
      usage: { promptTokens: 2000, completionTokens: 800, totalTokens: 2800 },
    });

    const result = await worker.execute({
      query: "test",
      scoredSources: [],
      scoredClaims: [],
      jobConfidence: { confidence: 0.7, claimCount: 2, sourceCount: 8, hasContradictions: false },
    });

    expect(result.synthesis).toContain("Full Research Report");
    expect(result.tokenUsage).toHaveProperty("totalTokens", 2800);
  });

  test("handles LLM failure with error message", async () => {
    mockRouter.route.mockRejectedValue(new Error("Model overloaded"));

    const result = await worker.execute({
      query: "test",
      scoredSources: [],
      scoredClaims: [],
      jobConfidence: { confidence: 0.5, claimCount: 0, sourceCount: 0, hasContradictions: false },
    });

    expect(result.synthesis).toContain("failed");
    expect(result.error).toBe("Model overloaded");
  });

  test("calls modelRouter.route", async () => {
    mockRouter.route.mockResolvedValue({
      text: "Report",
      usage: { totalTokens: 100 },
    });

    await worker.execute({
      query: "test",
      scoredSources: [],
      scoredClaims: [],
      jobConfidence: { confidence: 0.5, claimCount: 0, sourceCount: 0, hasContradictions: false },
    });

    expect(mockRouter.route).toHaveBeenCalledTimes(1);
  });
});
