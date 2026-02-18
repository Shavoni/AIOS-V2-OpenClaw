/**
 * WebCrawler — TDD tests
 * Verifies URL content fetching, HTML text extraction, and RAG integration.
 */

const { WebCrawler } = require("../../src/agents/web-crawler");

// Mock global fetch for testing
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("WebCrawler", () => {
  let crawler;

  beforeEach(() => {
    mockFetch.mockReset();
    crawler = new WebCrawler();
  });

  // --- Basic fetching ---
  test("fetchAndParse fetches URL and extracts text", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([["content-type", "text/html"]]),
      text: async () => `<html><body><h1>Cleveland API</h1><p>Gateway for city services.</p></body></html>`,
    });

    const result = await crawler.fetchAndParse("https://example.com");
    expect(result.text).toContain("Cleveland API");
    expect(result.text).toContain("Gateway for city services");
    expect(result.url).toBe("https://example.com");
    expect(result.ok).toBe(true);
  });

  test("fetchAndParse strips scripts, styles, and nav elements", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([["content-type", "text/html"]]),
      text: async () => `<html>
        <head><style>body{color:red}</style></head>
        <body>
          <nav>Menu items</nav>
          <main><p>Important content here.</p></main>
          <script>alert('xss')</script>
          <footer>Footer text</footer>
        </body>
      </html>`,
    });

    const result = await crawler.fetchAndParse("https://example.com");
    expect(result.text).toContain("Important content here");
    expect(result.text).not.toContain("alert");
    expect(result.text).not.toContain("body{color:red}");
  });

  test("fetchAndParse extracts page title", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([["content-type", "text/html"]]),
      text: async () => `<html><head><title>My Page</title></head><body><p>Content</p></body></html>`,
    });

    const result = await crawler.fetchAndParse("https://example.com");
    expect(result.title).toBe("My Page");
  });

  // --- Error handling ---
  test("fetchAndParse handles 404 errors", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => "Not Found",
    });

    const result = await crawler.fetchAndParse("https://example.com/404");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("404");
    expect(result.text).toBe("");
  });

  test("fetchAndParse handles network errors", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const result = await crawler.fetchAndParse("https://example.com");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Network error");
    expect(result.text).toBe("");
  });

  test("fetchAndParse handles timeout", async () => {
    mockFetch.mockImplementation(() => new Promise((_, reject) => {
      setTimeout(() => reject(new Error("AbortError: signal timed out")), 100);
    }));

    const result = await crawler.fetchAndParse("https://slow.example.com");
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  // --- Content type handling ---
  test("fetchAndParse handles plain text responses", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([["content-type", "text/plain"]]),
      text: async () => "This is plain text content about AI governance.",
    });

    const result = await crawler.fetchAndParse("https://example.com/readme.txt");
    expect(result.text).toBe("This is plain text content about AI governance.");
  });

  test("fetchAndParse handles JSON responses", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([["content-type", "application/json"]]),
      text: async () => JSON.stringify({ name: "API", version: "2.0" }),
    });

    const result = await crawler.fetchAndParse("https://example.com/api.json");
    expect(result.text).toContain("API");
    expect(result.text).toContain("2.0");
  });

  // --- Content limits ---
  test("fetchAndParse respects maxContentLength", async () => {
    const longContent = "A".repeat(200000);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([["content-type", "text/plain"]]),
      text: async () => longContent,
    });

    const result = await crawler.fetchAndParse("https://example.com", { maxContentLength: 1000 });
    expect(result.text.length).toBeLessThanOrEqual(1000);
  });

  // --- URL validation ---
  test("fetchAndParse rejects invalid URLs", async () => {
    const result = await crawler.fetchAndParse("not-a-url");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Invalid URL");
  });

  test("fetchAndParse rejects non-http protocols", async () => {
    const result = await crawler.fetchAndParse("ftp://example.com");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("protocol");
  });

  // --- refreshWebSource integration ---
  test("refreshWebSource fetches, indexes, and returns stats", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([["content-type", "text/html"]]),
      text: async () => `<html><body><h1>Department Info</h1><p>Public safety services for Cleveland residents.</p></body></html>`,
    });

    const mockRag = {
      indexDocument: jest.fn().mockReturnValue(3),
      removeDocument: jest.fn(),
    };
    const mockAgentManager = {
      updateWebSource: jest.fn(),
    };

    const result = await crawler.refreshWebSource(
      { id: "ws-1", agent_id: "agent-1", url: "https://example.com", name: "Dept" },
      { rag: mockRag, agentManager: mockAgentManager }
    );

    expect(result.ok).toBe(true);
    expect(result.chunksIndexed).toBe(3);
    expect(mockRag.indexDocument).toHaveBeenCalledWith(
      "agent-1",
      expect.stringContaining("ws-1"),
      expect.stringContaining("Public safety"),
      expect.objectContaining({ source: "web_crawl" })
    );
    expect(mockAgentManager.updateWebSource).toHaveBeenCalledWith(
      "ws-1",
      expect.objectContaining({ last_refreshed: expect.any(String) })
    );
  });

  test("refreshWebSource handles fetch failures gracefully", async () => {
    mockFetch.mockRejectedValue(new Error("Connection refused"));

    const mockRag = { indexDocument: jest.fn(), removeDocument: jest.fn() };
    const mockAgentManager = { updateWebSource: jest.fn() };

    const result = await crawler.refreshWebSource(
      { id: "ws-2", agent_id: "agent-1", url: "https://down.example.com", name: "Down" },
      { rag: mockRag, agentManager: mockAgentManager }
    );

    expect(result.ok).toBe(false);
    expect(mockRag.indexDocument).not.toHaveBeenCalled();
  });

  // --- Bulk refresh ---
  test("refreshAllStale fetches sources past their refresh interval", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([["content-type", "text/html"]]),
      text: async () => `<html><body><p>Refreshed content.</p></body></html>`,
    });

    const staleSource = {
      id: "ws-stale",
      agent_id: "agent-1",
      url: "https://example.com/stale",
      name: "Stale",
      auto_refresh: 1,
      refresh_interval_hours: 1,
      last_refreshed: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    };
    const freshSource = {
      id: "ws-fresh",
      agent_id: "agent-1",
      url: "https://example.com/fresh",
      name: "Fresh",
      auto_refresh: 1,
      refresh_interval_hours: 24,
      last_refreshed: new Date().toISOString(), // just refreshed
    };

    const mockRag = { indexDocument: jest.fn().mockReturnValue(2), removeDocument: jest.fn() };
    const mockAgentManager = {
      updateWebSource: jest.fn(),
    };

    const stats = await crawler.refreshAllStale(
      [staleSource, freshSource],
      { rag: mockRag, agentManager: mockAgentManager }
    );

    expect(stats.refreshed).toBe(1);
    expect(stats.skipped).toBe(1);
    expect(stats.errors).toBe(0);
  });

  test("refreshAllStale skips sources with auto_refresh disabled", async () => {
    const disabledSource = {
      id: "ws-disabled",
      agent_id: "agent-1",
      url: "https://example.com",
      name: "Disabled",
      auto_refresh: 0,
      refresh_interval_hours: 1,
      last_refreshed: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    };

    const mockRag = { indexDocument: jest.fn(), removeDocument: jest.fn() };
    const mockAgentManager = { updateWebSource: jest.fn() };

    const stats = await crawler.refreshAllStale(
      [disabledSource],
      { rag: mockRag, agentManager: mockAgentManager }
    );

    expect(stats.refreshed).toBe(0);
    expect(stats.skipped).toBe(1);
  });
});
