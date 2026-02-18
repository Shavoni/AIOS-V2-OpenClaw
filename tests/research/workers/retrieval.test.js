const { RetrievalWorker } = require("../../../src/research/workers/retrieval");

describe("RetrievalWorker", () => {
  let worker, mockRag, originalFetch;

  beforeEach(() => {
    mockRag = {
      retrieveContext: jest.fn().mockReturnValue(""),
      search: { search: jest.fn().mockReturnValue([]) },
    };
    originalFetch = global.fetch;
    global.fetch = jest.fn();
    worker = new RetrievalWorker(mockRag, { tavilyApiKey: "test-key" });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("calls RAG search for each sub-question", async () => {
    mockRag.search.search.mockReturnValue([
      { text: "Result 1", metadata: { documentId: "doc1" }, score: 0.9 },
    ]);

    await worker.execute(["q1", "q2"], "agent-1");
    expect(mockRag.search.search).toHaveBeenCalledTimes(2);
  });

  test("deduplicates chunks across sub-questions by text hash", async () => {
    mockRag.search.search.mockReturnValue([
      { text: "Same chunk text", metadata: { documentId: "doc1" }, score: 0.8 },
    ]);

    const result = await worker.execute(["q1", "q2"], "agent-1");
    const texts = result.map((r) => r.text);
    expect(new Set(texts).size).toBe(texts.length);
  });

  test("calls Tavily API for web retrieval when configured", async () => {
    mockRag.search.search.mockReturnValue([]);
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: [
          { url: "https://example.com", title: "Example", content: "Web content" },
        ],
      }),
    });

    await worker.execute(["test query"], "agent-1");
    expect(global.fetch).toHaveBeenCalled();
    const fetchCall = global.fetch.mock.calls[0];
    expect(fetchCall[0]).toContain("tavily");
  });

  test("skips web retrieval when Tavily API key is missing", async () => {
    const noWebWorker = new RetrievalWorker(mockRag, {});
    mockRag.search.search.mockReturnValue([]);

    await noWebWorker.execute(["test"], "agent-1");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("merges RAG and web results using Reciprocal Rank Fusion", async () => {
    mockRag.search.search.mockReturnValue([
      { text: "RAG result 1", metadata: {}, score: 0.9 },
      { text: "RAG result 2", metadata: {}, score: 0.7 },
    ]);
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: [
          { url: "https://a.com", title: "Web 1", content: "Web result 1" },
          { url: "https://b.com", title: "Web 2", content: "Web result 2" },
        ],
      }),
    });

    const result = await worker.execute(["test"], "agent-1");
    expect(result.length).toBeGreaterThan(0);
    // Results should be sorted by RRF score
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].rrfScore).toBeGreaterThanOrEqual(result[i].rrfScore);
    }
  });

  test("RRF: item ranked #1 in both lists gets highest fused score", () => {
    const ragResults = [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
    ];
    const webResults = [
      { id: "a", text: "A" },
      { id: "c", text: "C" },
    ];

    const fused = worker._reciprocalRankFusion([ragResults, webResults]);
    expect(fused[0].id).toBe("a");
  });

  test("RRF: uses k=60 constant for rank fusion", () => {
    const list = [{ id: "x", text: "X" }];
    const fused = worker._reciprocalRankFusion([list]);
    // Score for rank 0 with k=60: 1/(60+1) ≈ 0.01639
    expect(fused[0].rrfScore).toBeCloseTo(1 / 61, 4);
  });

  test("attaches retrieval_method tag to each source", async () => {
    mockRag.search.search.mockReturnValue([
      { text: "RAG chunk", metadata: {}, score: 0.8 },
    ]);
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: [{ url: "https://x.com", title: "Web", content: "Web chunk" }],
      }),
    });

    const result = await worker.execute(["test"], "agent-1");
    const ragSources = result.filter((r) => r.retrievalMethod === "rag");
    const webSources = result.filter((r) => r.retrievalMethod === "web");
    expect(ragSources.length).toBeGreaterThan(0);
    expect(webSources.length).toBeGreaterThan(0);
  });

  test("handles RAG failure gracefully, falls back to web-only", async () => {
    mockRag.search.search.mockImplementation(() => { throw new Error("RAG down"); });
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: [{ url: "https://x.com", title: "Web", content: "content" }],
      }),
    });

    const result = await worker.execute(["test"], "agent-1");
    expect(result.length).toBeGreaterThan(0);
  });

  test("handles web failure gracefully, falls back to RAG-only", async () => {
    mockRag.search.search.mockReturnValue([
      { text: "RAG only", metadata: {}, score: 0.8 },
    ]);
    global.fetch.mockRejectedValue(new Error("Network error"));

    const result = await worker.execute(["test"], "agent-1");
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].retrievalMethod).toBe("rag");
  });
});
