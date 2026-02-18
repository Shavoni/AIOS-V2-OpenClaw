/**
 * Tests for Embedding Provider Interface (Batch 4A)
 * TDD: Tests written first, then implementation.
 */

const {
  OpenAIEmbedder,
  OllamaEmbedder,
  createEmbeddingProvider,
} = require("../../src/rag/embedding-provider");

// ── Helpers ──────────────────────────────────────────────────────────
const mockFetchSuccess = (responseBody) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => responseBody,
  });
};

const mockFetchFailure = () => {
  global.fetch = jest.fn().mockRejectedValue(new Error("network error"));
};

const mockFetchHttpError = () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 500,
    statusText: "Internal Server Error",
    json: async () => ({ error: "server error" }),
  });
};

afterEach(() => {
  delete global.fetch;
});

// ── OpenAIEmbedder ──────────────────────────────────────────────────
describe("OpenAIEmbedder", () => {
  const config = {
    type: "openai",
    apiKey: "sk-test-key-123",
    model: "text-embedding-3-small",
    baseUrl: "https://api.openai.com/v1",
    dimensions: 1536,
  };

  test("embed(text) calls OpenAI embeddings API and returns Float32Array", async () => {
    const fakeEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
    mockFetchSuccess({ data: [{ embedding: fakeEmbedding }] });

    const embedder = new OpenAIEmbedder(config);
    const result = await embedder.embed("Hello world");

    // Verify fetch was called correctly
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/embeddings");
    expect(options.method).toBe("POST");
    expect(options.headers["Authorization"]).toBe("Bearer sk-test-key-123");
    expect(options.headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(options.body);
    expect(body.input).toBe("Hello world");
    expect(body.model).toBe("text-embedding-3-small");

    // Verify result is Float32Array
    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBe(5);
    expect(result[0]).toBeCloseTo(0.1);
    expect(result[4]).toBeCloseTo(0.5);
  });

  test("embed(text) returns null on API failure (network error)", async () => {
    mockFetchFailure();

    const embedder = new OpenAIEmbedder(config);
    const result = await embedder.embed("Hello world");

    expect(result).toBeNull();
  });

  test("embed(text) returns null on HTTP error response", async () => {
    mockFetchHttpError();

    const embedder = new OpenAIEmbedder(config);
    const result = await embedder.embed("Hello world");

    expect(result).toBeNull();
  });

  test("embedBatch(texts) returns array of Float32Array embeddings", async () => {
    const fakeEmbeddings = [
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
      [0.7, 0.8, 0.9],
    ];
    mockFetchSuccess({
      data: fakeEmbeddings.map((embedding, i) => ({ embedding, index: i })),
    });

    const embedder = new OpenAIEmbedder(config);
    const result = await embedder.embedBatch(["text1", "text2", "text3"]);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(3);

    for (let i = 0; i < result.length; i++) {
      expect(result[i]).toBeInstanceOf(Float32Array);
      expect(result[i].length).toBe(3);
    }

    expect(result[0][0]).toBeCloseTo(0.1);
    expect(result[2][2]).toBeCloseTo(0.9);

    // OpenAI batch sends all texts in one request
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.input).toEqual(["text1", "text2", "text3"]);
  });

  test("embedBatch returns null entries on failure", async () => {
    mockFetchFailure();

    const embedder = new OpenAIEmbedder(config);
    const result = await embedder.embedBatch(["text1", "text2"]);

    expect(result).toBeNull();
  });

  test("uses default config values when not provided", () => {
    const embedder = new OpenAIEmbedder({ apiKey: "sk-minimal" });
    expect(embedder.model).toBe("text-embedding-3-small");
    expect(embedder.baseUrl).toBe("https://api.openai.com/v1");
    expect(embedder.dimensions).toBe(1536);
  });
});

// ── OllamaEmbedder ─────────────────────────────────────────────────
describe("OllamaEmbedder", () => {
  const config = {
    type: "ollama",
    model: "nomic-embed-text",
    baseUrl: "http://localhost:11434",
  };

  test("embed(text) calls Ollama API and returns Float32Array", async () => {
    const fakeEmbedding = [0.11, 0.22, 0.33, 0.44];
    mockFetchSuccess({ embedding: fakeEmbedding });

    const embedder = new OllamaEmbedder(config);
    const result = await embedder.embed("Hello Ollama");

    // Verify fetch was called correctly
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe("http://localhost:11434/api/embeddings");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(options.body);
    expect(body.prompt).toBe("Hello Ollama");
    expect(body.model).toBe("nomic-embed-text");

    // Verify result is Float32Array
    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBe(4);
    expect(result[0]).toBeCloseTo(0.11);
    expect(result[3]).toBeCloseTo(0.44);
  });

  test("embed(text) returns null on API failure", async () => {
    mockFetchFailure();

    const embedder = new OllamaEmbedder(config);
    const result = await embedder.embed("Hello");

    expect(result).toBeNull();
  });

  test("embed(text) returns null on HTTP error response", async () => {
    mockFetchHttpError();

    const embedder = new OllamaEmbedder(config);
    const result = await embedder.embed("Hello");

    expect(result).toBeNull();
  });

  test("embedBatch(texts) returns array of Float32Array via sequential calls", async () => {
    // Ollama doesn't support batch natively, so each text is a separate call
    let callCount = 0;
    const embeddings = [
      [0.1, 0.2],
      [0.3, 0.4],
    ];
    global.fetch = jest.fn().mockImplementation(async () => {
      const embedding = embeddings[callCount++];
      return {
        ok: true,
        json: async () => ({ embedding }),
      };
    });

    const embedder = new OllamaEmbedder(config);
    const result = await embedder.embedBatch(["text1", "text2"]);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);

    expect(result[0]).toBeInstanceOf(Float32Array);
    expect(result[1]).toBeInstanceOf(Float32Array);
    expect(result[0][0]).toBeCloseTo(0.1);
    expect(result[1][1]).toBeCloseTo(0.4);

    // Ollama: one fetch per text (sequential)
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test("embedBatch returns nulls for individually failed calls", async () => {
    let callCount = 0;
    global.fetch = jest.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 2) {
        throw new Error("network error on second call");
      }
      return {
        ok: true,
        json: async () => ({ embedding: [0.1, 0.2] }),
      };
    });

    const embedder = new OllamaEmbedder(config);
    const result = await embedder.embedBatch(["text1", "text2", "text3"]);

    expect(result.length).toBe(3);
    expect(result[0]).toBeInstanceOf(Float32Array);
    expect(result[1]).toBeNull();
    expect(result[2]).toBeInstanceOf(Float32Array);
  });

  test("uses default config values when not provided", () => {
    const embedder = new OllamaEmbedder({});
    expect(embedder.model).toBe("nomic-embed-text");
    expect(embedder.baseUrl).toBe("http://localhost:11434");
  });
});

// ── createEmbeddingProvider factory ─────────────────────────────────
describe("createEmbeddingProvider", () => {
  test("returns OpenAIEmbedder for type 'openai'", () => {
    const provider = createEmbeddingProvider({
      type: "openai",
      apiKey: "sk-test",
      model: "text-embedding-3-small",
    });
    expect(provider).toBeInstanceOf(OpenAIEmbedder);
    expect(provider.apiKey).toBe("sk-test");
    expect(provider.model).toBe("text-embedding-3-small");
  });

  test("returns OllamaEmbedder for type 'ollama'", () => {
    const provider = createEmbeddingProvider({
      type: "ollama",
      model: "nomic-embed-text",
      baseUrl: "http://localhost:11434",
    });
    expect(provider).toBeInstanceOf(OllamaEmbedder);
    expect(provider.model).toBe("nomic-embed-text");
  });

  test("returns null when config is null", () => {
    const provider = createEmbeddingProvider(null);
    expect(provider).toBeNull();
  });

  test("returns null when config is undefined", () => {
    const provider = createEmbeddingProvider(undefined);
    expect(provider).toBeNull();
  });

  test("returns null for unknown provider type", () => {
    const provider = createEmbeddingProvider({ type: "unknown" });
    expect(provider).toBeNull();
  });
});
