/**
 * ManusAPIClient — TDD tests
 * Unit tests with mocked fetch + live smoke test against real API.
 */

const { ManusAPIClient } = require("../../src/agents/manus-api-client");

// --- Mock fetch helper ---
function mockFetch(responses) {
  const calls = [];
  let callIndex = 0;

  const fn = async (url, opts) => {
    calls.push({ url, opts });
    const response = responses[callIndex] || responses[responses.length - 1];
    callIndex++;
    return {
      ok: response.ok !== false,
      status: response.status || 200,
      json: async () => response.json,
      text: async () => JSON.stringify(response.json || {}),
    };
  };

  fn.calls = calls;
  return fn;
}

describe("ManusAPIClient", () => {
  // --- Constructor ---
  test("throws if no API key provided", () => {
    const origKey = process.env.MANUS_API_KEY;
    delete process.env.MANUS_API_KEY;
    expect(() => new ManusAPIClient({})).toThrow("MANUS_API_KEY is required");
    if (origKey) process.env.MANUS_API_KEY = origKey;
  });

  test("accepts apiKey in constructor", () => {
    const client = new ManusAPIClient({ apiKey: "test-key" });
    expect(client.apiKey).toBe("test-key");
  });

  test("falls back to MANUS_API_KEY env var", () => {
    process.env.MANUS_API_KEY = "env-key";
    const client = new ManusAPIClient({});
    expect(client.apiKey).toBe("env-key");
    delete process.env.MANUS_API_KEY;
  });

  // --- createTask ---
  test("createTask sends POST /tasks with prompt and agentProfile", async () => {
    const fetch = mockFetch([{
      json: { task_id: "task-1", task_title: "Test", task_url: "https://manus.im/app/task-1" },
    }]);

    const client = new ManusAPIClient({ apiKey: "key-123", fetchFn: fetch });
    const result = await client.createTask({ prompt: "Research Cleveland" });

    expect(result.task_id).toBe("task-1");
    expect(fetch.calls[0].url).toContain("/tasks");
    expect(fetch.calls[0].opts.method).toBe("POST");

    const body = JSON.parse(fetch.calls[0].opts.body);
    expect(body.prompt).toBe("Research Cleveland");
    expect(body.agentProfile).toBe("manus-1.6");
  });

  test("createTask passes optional taskMode and attachments", async () => {
    const fetch = mockFetch([{ json: { task_id: "task-2" } }]);
    const client = new ManusAPIClient({ apiKey: "key", fetchFn: fetch });

    await client.createTask({
      prompt: "Analyze data",
      taskMode: "agent",
      attachments: [{ filename: "data.csv", file_id: "f-1" }],
    });

    const body = JSON.parse(fetch.calls[0].opts.body);
    expect(body.taskMode).toBe("agent");
    expect(body.attachments).toHaveLength(1);
  });

  test("createTask sends API_KEY header", async () => {
    const fetch = mockFetch([{ json: { task_id: "task-3" } }]);
    const client = new ManusAPIClient({ apiKey: "secret-key", fetchFn: fetch });

    await client.createTask({ prompt: "test" });

    expect(fetch.calls[0].opts.headers["API_KEY"]).toBe("secret-key");
  });

  // --- getTask ---
  test("getTask sends GET /tasks/:id", async () => {
    const fetch = mockFetch([{
      json: { id: "task-1", status: "completed", output: [] },
    }]);

    const client = new ManusAPIClient({ apiKey: "key", fetchFn: fetch });
    const task = await client.getTask("task-1");

    expect(task.id).toBe("task-1");
    expect(fetch.calls[0].url).toContain("/tasks/task-1");
    expect(fetch.calls[0].opts.method).toBe("GET");
  });

  // --- listTasks ---
  test("listTasks sends GET /tasks with query params", async () => {
    const fetch = mockFetch([{
      json: { object: "list", data: [], has_more: false },
    }]);

    const client = new ManusAPIClient({ apiKey: "key", fetchFn: fetch });
    await client.listTasks({ limit: 5, order: "desc", status: ["completed"] });

    const url = fetch.calls[0].url;
    expect(url).toContain("limit=5");
    expect(url).toContain("order=desc");
    expect(url).toContain("status=completed");
  });

  test("listTasks works with no options", async () => {
    const fetch = mockFetch([{
      json: { object: "list", data: [{ id: "t1" }], has_more: false },
    }]);

    const client = new ManusAPIClient({ apiKey: "key", fetchFn: fetch });
    const result = await client.listTasks();

    expect(result.data).toHaveLength(1);
    expect(fetch.calls[0].url).toMatch(/\/tasks$/);
  });

  // --- pollTask ---
  test("pollTask returns immediately if task is completed", async () => {
    const fetch = mockFetch([{
      json: { id: "task-1", status: "completed", output: [] },
    }]);

    const client = new ManusAPIClient({ apiKey: "key", fetchFn: fetch });
    const task = await client.pollTask("task-1", { intervalMs: 10 });

    expect(task.status).toBe("completed");
    expect(fetch.calls).toHaveLength(1);
  });

  test("pollTask returns immediately if task is failed", async () => {
    const fetch = mockFetch([{
      json: { id: "task-1", status: "failed", error: "Out of credits" },
    }]);

    const client = new ManusAPIClient({ apiKey: "key", fetchFn: fetch });
    const task = await client.pollTask("task-1", { intervalMs: 10 });

    expect(task.status).toBe("failed");
  });

  test("pollTask retries until completed", async () => {
    const fetch = mockFetch([
      { json: { id: "task-1", status: "running" } },
      { json: { id: "task-1", status: "running" } },
      { json: { id: "task-1", status: "completed", output: [{ role: "assistant", content: [{ type: "output_text", text: "Done" }] }] } },
    ]);

    const client = new ManusAPIClient({ apiKey: "key", fetchFn: fetch });
    const statuses = [];
    const task = await client.pollTask("task-1", {
      intervalMs: 10,
      onStatus: (t) => statuses.push(t.status),
    });

    expect(task.status).toBe("completed");
    expect(fetch.calls.length).toBe(3);
    expect(statuses).toEqual(["running", "running", "completed"]);
  });

  test("pollTask throws on timeout", async () => {
    const fetch = mockFetch([{ json: { id: "task-1", status: "running" } }]);

    const client = new ManusAPIClient({ apiKey: "key", fetchFn: fetch });

    await expect(
      client.pollTask("task-1", { intervalMs: 10, timeoutMs: 50 })
    ).rejects.toThrow("timed out");
  });

  // --- extractOutput ---
  test("extractOutput returns texts and files from assistant messages", () => {
    const client = new ManusAPIClient({ apiKey: "key" });
    const task = {
      output: [
        { role: "user", content: [{ type: "output_text", text: "prompt" }] },
        {
          role: "assistant",
          content: [
            { type: "output_text", text: "Answer line 1" },
            { type: "output_text", text: "Answer line 2" },
            { type: "output_file", fileName: "report.md", fileUrl: "https://files.manus.ai/report.md", mimeType: "text/markdown" },
          ],
        },
      ],
    };

    const { texts, files } = client.extractOutput(task);
    expect(texts).toEqual(["Answer line 1", "Answer line 2"]);
    expect(files).toHaveLength(1);
    expect(files[0].fileName).toBe("report.md");
  });

  test("extractOutput handles task with no output", () => {
    const client = new ManusAPIClient({ apiKey: "key" });
    const { texts, files } = client.extractOutput({});
    expect(texts).toEqual([]);
    expect(files).toEqual([]);
  });

  test("extractOutput ignores user messages", () => {
    const client = new ManusAPIClient({ apiKey: "key" });
    const task = {
      output: [
        { role: "user", content: [{ type: "output_text", text: "user prompt" }] },
      ],
    };

    const { texts } = client.extractOutput(task);
    expect(texts).toEqual([]);
  });

  // --- Error handling ---
  test("throws on non-OK response with status and body", async () => {
    const fetch = mockFetch([{
      ok: false,
      status: 401,
      json: { error: "Invalid API key" },
    }]);

    const client = new ManusAPIClient({ apiKey: "bad-key", fetchFn: fetch });

    await expect(client.getTask("t1")).rejects.toThrow("401");
  });

  test("createAndWait creates then polls to completion", async () => {
    const fetch = mockFetch([
      { json: { task_id: "new-task" } },
      { json: { id: "new-task", status: "completed", output: [] } },
    ]);

    const client = new ManusAPIClient({ apiKey: "key", fetchFn: fetch });
    const task = await client.createAndWait(
      { prompt: "test" },
      { intervalMs: 10 }
    );

    expect(task.status).toBe("completed");
    expect(fetch.calls).toHaveLength(2);
    expect(fetch.calls[0].opts.method).toBe("POST");
    expect(fetch.calls[1].opts.method).toBe("GET");
  });
});

// --- Live API smoke test (only runs if MANUS_API_KEY is set) ---
const LIVE_API_KEY = process.env.MANUS_API_KEY;

const describeIfLive = LIVE_API_KEY ? describe : describe.skip;

describeIfLive("ManusAPIClient — Live API", () => {
  let client;

  beforeAll(() => {
    client = new ManusAPIClient({ apiKey: LIVE_API_KEY });
  });

  test("listTasks returns task list from MANUS API", async () => {
    const result = await client.listTasks({ limit: 3 });
    expect(result.object).toBe("list");
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeLessThanOrEqual(3);
  }, 15000);

  test("getTask retrieves a specific task", async () => {
    const list = await client.listTasks({ limit: 1 });
    if (!list.data.length) return; // No tasks to test

    const task = await client.getTask(list.data[0].id);
    expect(task.id).toBe(list.data[0].id);
    expect(task.status).toBeTruthy();
  }, 15000);
}, 30000);
