const BaseProvider = require("./base-provider");

class OllamaProvider extends BaseProvider {
  constructor(providerConfig) {
    super("ollama", providerConfig);
    this.host = providerConfig.host;
    this.defaultModel = providerConfig.defaultModel || "llama3";
  }

  async healthCheck() {
    try {
      const res = await fetch(`${this.host}/api/tags`);
      this.available = res.ok;
      this.lastChecked = Date.now();
      if (res.ok) this.errorCount = 0;
      return this.available;
    } catch {
      this.available = false;
      this.lastChecked = Date.now();
      this.errorCount++;
      return false;
    }
  }

  async listModels() {
    try {
      const res = await fetch(`${this.host}/api/tags`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.models || []).map((m) => m.name || m.model);
    } catch {
      return [];
    }
  }

  async chatCompletion({ messages, model, temperature = 0.7, maxTokens }) {
    const modelName = model || this.defaultModel;
    const start = Date.now();

    const res = await fetch(`${this.host}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelName,
        messages,
        stream: false,
        options: {
          temperature,
          ...(maxTokens && { num_predict: maxTokens }),
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama error ${res.status}: ${text}`);
    }

    const data = await res.json();
    const latencyMs = Date.now() - start;

    return {
      content: data.message?.content || "",
      provider: "ollama",
      model: modelName,
      usage: {
        promptTokens: data.prompt_eval_count || 0,
        completionTokens: data.eval_count || 0,
        totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
      cost: 0,
      latencyMs,
    };
  }

  async *streamCompletion({ messages, model, temperature = 0.7, maxTokens }) {
    const modelName = model || this.defaultModel;

    const res = await fetch(`${this.host}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelName,
        messages,
        stream: true,
        options: {
          temperature,
          ...(maxTokens && { num_predict: maxTokens }),
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama stream error ${res.status}: ${text}`);
    }

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
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          if (data.message?.content) {
            yield { text: data.message.content, done: data.done || false };
          }
          if (data.done) {
            yield {
              text: "",
              done: true,
              usage: {
                promptTokens: data.prompt_eval_count || 0,
                completionTokens: data.eval_count || 0,
              },
            };
          }
        } catch {
          // Skip malformed lines
        }
      }
    }
  }
}

module.exports = OllamaProvider;
