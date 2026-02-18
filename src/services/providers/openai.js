const BaseProvider = require("./base-provider");
const { calculateCost } = require("../../utils/cost-calculator");

class OpenAIProvider extends BaseProvider {
  constructor(providerConfig) {
    super("openai", providerConfig);
    this.apiKey = providerConfig.apiKey;
    this.baseUrl = providerConfig.baseUrl;
    this.defaultModel = providerConfig.defaultModel || "gpt-4o-mini";
  }

  async healthCheck() {
    if (!this.apiKey) {
      this.available = false;
      this.lastChecked = Date.now();
      return false;
    }
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
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
    if (!this.apiKey) return [];
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.data || [])
        .filter((m) => m.id.startsWith("gpt"))
        .map((m) => m.id)
        .sort();
    } catch {
      return [];
    }
  }

  async chatCompletion({ messages, model, temperature = 0.7, maxTokens }) {
    const modelName = model || this.defaultModel;
    const start = Date.now();

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        temperature,
        ...(maxTokens && { max_tokens: maxTokens }),
        stream: false,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI error ${res.status}: ${text}`);
    }

    const data = await res.json();
    const latencyMs = Date.now() - start;
    const usage = data.usage || {};
    const cost = calculateCost(
      modelName,
      usage.prompt_tokens || 0,
      usage.completion_tokens || 0
    );

    return {
      content: data.choices?.[0]?.message?.content || "",
      provider: "openai",
      model: modelName,
      usage: {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0,
      },
      cost,
      latencyMs,
    };
  }

  async *streamCompletion({ messages, model, temperature = 0.7, maxTokens }) {
    const modelName = model || this.defaultModel;

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        temperature,
        ...(maxTokens && { max_tokens: maxTokens }),
        stream: true,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI stream error ${res.status}: ${text}`);
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
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const payload = trimmed.slice(6);
        if (payload === "[DONE]") {
          yield { text: "", done: true };
          return;
        }
        try {
          const data = JSON.parse(payload);
          const delta = data.choices?.[0]?.delta?.content || "";
          if (delta) {
            yield { text: delta, done: false };
          }
        } catch {
          // Skip
        }
      }
    }
  }
}

module.exports = OpenAIProvider;
