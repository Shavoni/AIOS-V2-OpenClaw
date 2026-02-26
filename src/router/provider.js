

class ProviderClient {
  constructor({ id, baseUrl, apiKey, defaultModel }) {
    this.id = id;
    this.baseUrl = baseUrl;
    this.apiKey = apiKey || "not-needed";
    this.defaultModel = defaultModel;
    this._healthy = true;
    this._lastError = null;
    this._isAnthropic = id === "anthropic";

    if (!this._isAnthropic) {
      this.client = new OpenAI({
        baseURL: baseUrl,
        apiKey: this.apiKey,
        timeout: 30000,
        maxRetries: 1,
      });
    }
  }

  async complete(messages, options = {}) {
    if (this._isAnthropic) return this._anthropicComplete(messages, options);

    const model = options.model || this.defaultModel;
    const start = Date.now();

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens || 2048,
        stream: false,
      });

      this._healthy = true;
      const choice = response.choices[0];
      return {
        text: choice.message.content || "",
        model: response.model || model,
        provider: this.id,
        usage: response.usage
          ? { prompt: response.usage.prompt_tokens, completion: response.usage.completion_tokens }
          : null,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      this._healthy = false;
      this._lastError = err.message;
      throw err;
    }
  }

  async *completeStream(messages, options = {}) {
    if (this._isAnthropic) {
      yield* this._anthropicStream(messages, options);
      return;
    }

    const model = options.model || this.defaultModel;

    try {
      const stream = await this.client.chat.completions.create({
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens || 2048,
        stream: true,
      });

      this._healthy = true;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          yield { text: delta, model: chunk.model || model, provider: this.id };
        }
      }
    } catch (err) {
      this._healthy = false;
      this._lastError = err.message;
      throw err;
    }
  }

  async healthCheck() {
    if (this._isAnthropic) return this._anthropicHealthCheck();

    try {
      await this.client.models.list();
      this._healthy = true;
      return true;
    } catch (_) {
      try {
        await this.client.chat.completions.create({
          model: this.defaultModel,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 1,
        });
        this._healthy = true;
        return true;
      } catch (err) {
        this._healthy = false;
        this._lastError = err.message;
        return false;
      }
    }
  }

  get healthy() { return this._healthy; }
  get lastError() { return this._lastError; }

  // --- Anthropic native adapter ---

  _convertMessages(messages) {
    let system = "";
    const anthropicMessages = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        system += (system ? "\n\n" : "") + msg.content;
      } else {
        anthropicMessages.push({ role: msg.role, content: msg.content });
      }
    }

    return { system: system || undefined, anthropicMessages };
  }

  async _anthropicComplete(messages, options = {}) {
    const model = options.model || this.defaultModel || "claude-sonnet-4-20250514";
    const start = Date.now();
    const { system, anthropicMessages } = this._convertMessages(messages);

    try {
      const res = await fetch(`${this.baseUrl}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: options.maxTokens || 4096,
          temperature: options.temperature ?? 0.7,
          ...(system && { system }),
          messages: anthropicMessages,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Anthropic error ${res.status}: ${text}`);
      }

      const data = await res.json();
      const usage = data.usage || {};

      this._healthy = true;
      return {
        text: data.content?.[0]?.text || "",
        model: data.model || model,
        provider: this.id,
        usage: {
          prompt: usage.input_tokens || 0,
          completion: usage.output_tokens || 0,
        },
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      this._healthy = false;
      this._lastError = err.message;
      throw err;
    }
  }

  async *_anthropicStream(messages, options = {}) {
    const model = options.model || this.defaultModel || "claude-sonnet-4-20250514";
    const { system, anthropicMessages } = this._convertMessages(messages);

    try {
      const res = await fetch(`${this.baseUrl}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: options.maxTokens || 4096,
          temperature: options.temperature ?? 0.7,
          stream: true,
          ...(system && { system }),
          messages: anthropicMessages,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Anthropic stream error ${res.status}: ${text}`);
      }

      this._healthy = true;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(trimmed.slice(6));
            if (data.type === "content_block_delta" && data.delta?.text) {
              yield { text: data.delta.text, model, provider: this.id };
            }
            if (data.type === "message_stop") {
              return;
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    } catch (err) {
      this._healthy = false;
      this._lastError = err.message;
      throw err;
    }
  }

  async _anthropicHealthCheck() {
    if (!this.apiKey || this.apiKey === "not-needed") {
      this._healthy = false;
      this._lastError = "No API key";
      return false;
    }
    // Anthropic doesn't have a lightweight health endpoint;
    // presence of a valid key is the best check without burning tokens
    this._healthy = true;
    return true;
  }
}

module.exports = { ProviderClient };
