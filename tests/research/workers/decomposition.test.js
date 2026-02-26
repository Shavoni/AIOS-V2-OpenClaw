const { DecompositionWorker } = require("../../../src/research/workers/decomposition");
const { createMockRouter } = require("../../fixtures/research-mocks");

describe("DecompositionWorker", () => {
  let worker, mockRouter;

  beforeEach(() => {
    mockRouter = createMockRouter();
    worker = new DecompositionWorker(mockRouter);
  });

  test("decomposes a query into sub-questions via LLM", async () => {
    mockRouter.route.mockResolvedValue({
      text: JSON.stringify([
        "What are the key principles of quantum computing?",
        "How do qubits differ from classical bits?",
        "What are current applications of quantum computing?",
      ]),
    });

    const result = await worker.execute("Explain quantum computing");
    expect(Array.isArray(result)).toBe(true);
    // Original query prepended + 3 LLM sub-questions = 4
    expect(result.length).toBe(4);
    expect(result[0]).toBe("Explain quantum computing");
  });

  test("calls modelRouter.route with structured prompt", async () => {
    mockRouter.route.mockResolvedValue({ text: '["sub-q1"]' });
    await worker.execute("test query");

    expect(mockRouter.route).toHaveBeenCalledTimes(1);
    const messages = mockRouter.route.mock.calls[0][0];
    expect(messages).toBeDefined();
    expect(messages.some((m) => m.content.includes("test query"))).toBe(true);
  });

  test("includes original query as first sub-question", async () => {
    mockRouter.route.mockResolvedValue({
      text: '["How does X work?", "Why is Y important?"]',
    });

    const result = await worker.execute("Original query");
    expect(result[0]).toBe("Original query");
  });

  test("caps sub-questions at 8", async () => {
    const many = Array.from({ length: 12 }, (_, i) => `Question ${i + 1}`);
    mockRouter.route.mockResolvedValue({ text: JSON.stringify(many) });

    const result = await worker.execute("test");
    // original + capped LLM = max 9, but we cap total at 8
    expect(result.length).toBeLessThanOrEqual(8);
  });

  test("returns original query wrapped in array if LLM fails", async () => {
    mockRouter.route.mockRejectedValue(new Error("timeout"));

    const result = await worker.execute("fallback query");
    expect(result).toEqual(["fallback query"]);
  });

  test("handles malformed LLM JSON response gracefully", async () => {
    mockRouter.route.mockResolvedValue({ text: "not valid json" });

    const result = await worker.execute("bad json query");
    expect(result).toEqual(["bad json query"]);
  });

  test("strips numbered prefixes from LLM output", async () => {
    mockRouter.route.mockResolvedValue({
      text: '["1. What is X?", "2. How does Y work?"]',
    });

    const result = await worker.execute("test");
    expect(result).toContain("What is X?");
    expect(result).toContain("How does Y work?");
  });

  test("deduplicates similar sub-questions", async () => {
    mockRouter.route.mockResolvedValue({
      text: '["What is quantum?", "What is quantum?", "How does it work?"]',
    });

    const result = await worker.execute("quantum");
    const unique = new Set(result);
    expect(result.length).toBe(unique.size);
  });
});
