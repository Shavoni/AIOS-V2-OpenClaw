/**
 * ManusAPIClient — REST client for the MANUS AI API.
 *
 * Supports: task creation, polling, listing, and output retrieval.
 * Base URL: https://api.manus.ai/v1
 * Auth: API_KEY header
 */

const BASE_URL = "https://api.manus.ai/v1";

class ManusAPIClient {
  /**
   * @param {Object} opts
   * @param {string} opts.apiKey - MANUS API key
   * @param {string} [opts.baseUrl] - Override base URL (for testing)
   * @param {Function} [opts.fetchFn] - Override fetch (for testing)
   */
  constructor({ apiKey, baseUrl, fetchFn } = {}) {
    this.apiKey = apiKey || process.env.MANUS_API_KEY;
    this.baseUrl = baseUrl || BASE_URL;
    this._fetch = fetchFn || globalThis.fetch;

    if (!this.apiKey) {
      throw new Error("MANUS_API_KEY is required");
    }
  }

  /**
   * Create a new MANUS task.
   *
   * @param {Object} opts
   * @param {string} opts.prompt - Task prompt/instructions
   * @param {string} [opts.agentProfile] - "manus-1.6" | "manus-1.6-lite" | "manus-1.6-max"
   * @param {string} [opts.taskMode] - "chat" | "adaptive" | "agent"
   * @param {Array} [opts.attachments] - File attachments
   * @param {string[]} [opts.connectors] - Connector IDs
   * @param {string} [opts.projectId] - Project ID
   * @returns {Promise<{ task_id: string, task_title: string, task_url: string }>}
   */
  async createTask(opts) {
    const body = {
      prompt: opts.prompt,
      agentProfile: opts.agentProfile || "manus-1.6",
    };
    if (opts.taskMode) body.taskMode = opts.taskMode;
    if (opts.attachments) body.attachments = opts.attachments;
    if (opts.connectors) body.connectors = opts.connectors;
    if (opts.projectId) body.projectId = opts.projectId;

    const res = await this._request("POST", "/tasks", body);
    return res;
  }

  /**
   * Get a single task by ID (includes output when completed).
   *
   * @param {string} taskId
   * @returns {Promise<Object>} Full task object with status, output, metadata
   */
  async getTask(taskId) {
    return this._request("GET", `/tasks/${taskId}`);
  }

  /**
   * List tasks with optional filters.
   *
   * @param {Object} [opts]
   * @param {number} [opts.limit] - Max results (1-1000, default 100)
   * @param {string} [opts.order] - "asc" | "desc"
   * @param {string[]} [opts.status] - Filter by status(es)
   * @param {string} [opts.after] - Cursor for pagination
   * @param {string} [opts.projectId] - Filter by project
   * @returns {Promise<{ data: Array, has_more: boolean, first_id: string, last_id: string }>}
   */
  async listTasks(opts = {}) {
    const params = new URLSearchParams();
    if (opts.limit) params.set("limit", opts.limit);
    if (opts.order) params.set("order", opts.order);
    if (opts.after) params.set("after", opts.after);
    if (opts.projectId) params.set("project_id", opts.projectId);
    if (opts.status) {
      for (const s of opts.status) params.append("status", s);
    }

    const qs = params.toString();
    return this._request("GET", `/tasks${qs ? "?" + qs : ""}`);
  }

  /**
   * Poll a task until it reaches a terminal status (completed or failed).
   *
   * @param {string} taskId
   * @param {Object} [opts]
   * @param {number} [opts.intervalMs] - Poll interval (default 5000)
   * @param {number} [opts.timeoutMs] - Max wait time (default 300000 = 5 min)
   * @param {Function} [opts.onStatus] - Callback on each poll with task object
   * @returns {Promise<Object>} Completed task with output
   */
  async pollTask(taskId, opts = {}) {
    const interval = opts.intervalMs || 5000;
    const timeout = opts.timeoutMs || 300000;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const task = await this.getTask(taskId);

      if (opts.onStatus) opts.onStatus(task);

      if (task.status === "completed" || task.status === "failed") {
        return task;
      }

      await this._sleep(interval);
    }

    throw new Error(`Task ${taskId} timed out after ${timeout}ms`);
  }

  /**
   * Create a task and wait for completion (convenience method).
   *
   * @param {Object} createOpts - Same as createTask opts
   * @param {Object} [pollOpts] - Same as pollTask opts
   * @returns {Promise<Object>} Completed task with output
   */
  async createAndWait(createOpts, pollOpts = {}) {
    const created = await this.createTask(createOpts);
    return this.pollTask(created.task_id, pollOpts);
  }

  /**
   * Extract text output from a completed task.
   *
   * @param {Object} task - Task object from getTask/pollTask
   * @returns {{ texts: string[], files: Array<{ fileName: string, fileUrl: string, mimeType: string }> }}
   */
  extractOutput(task) {
    const texts = [];
    const files = [];

    if (!task.output || !Array.isArray(task.output)) {
      return { texts, files };
    }

    for (const message of task.output) {
      if (message.role !== "assistant") continue;
      if (!Array.isArray(message.content)) continue;

      for (const item of message.content) {
        if (item.type === "output_text" && item.text) {
          texts.push(item.text);
        }
        if (item.type === "output_file" && item.fileUrl) {
          files.push({
            fileName: item.fileName || "unknown",
            fileUrl: item.fileUrl,
            mimeType: item.mimeType || "application/octet-stream",
          });
        }
      }
    }

    return { texts, files };
  }

  /** @private */
  async _request(method, path, body) {
    const url = `${this.baseUrl}${path}`;
    const opts = {
      method,
      headers: {
        "API_KEY": this.apiKey,
        "Content-Type": "application/json",
      },
    };

    if (body) opts.body = JSON.stringify(body);

    const res = await this._fetch(url, opts);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`MANUS API ${method} ${path} failed (${res.status}): ${text}`);
    }

    return res.json();
  }

  /** @private */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { ManusAPIClient };
