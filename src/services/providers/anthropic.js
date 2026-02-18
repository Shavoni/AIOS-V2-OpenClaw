const BaseProvider = require("./base-provider");
const { calculateCost } = require("../../utils/cost-calculator");

class AnthropicProvider extends BaseProvider {
  constructor(providerConfig) {
    super("anthropic", providerConfig);
    this.apiKey = providerConfig.apiKey;
    this.baseUrl = providerConfig.baseUrl;
    this.defaultModel = providerConfig.defaultModel || "claude-sonnet-4-20250514";
  }

  async healthCheck() {
    if (!this.apiKey) {
      this.available = false;
      this.lastChecked = Date.now();
      return false;
    }
    // Anthropic doesn't have a simple health endpoint, check if key is set
    this.available = true;
    this.lastChecked = Date.now();
    return true;
  }

  async listModels() {
    if (!this.apiKey) return [];
    return [
      "claude-opus-4-20250514",
      "claude-sonnet-4-20250514",
      "claude-haiku-4-20250514",
    ];
  }

  async chatCompletion({ messages, model, temperature = 0.7, maxTokens = 4096 }) {
    const modelName = model || this.defaultModel;
    const start = Date.now();

    // Convert OpenAI format to Anthropic format
    const { system, anthropicMessages } = this._convertMessages(messages);

    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: modelName,
        max_tokens: maxTokens,
        temperature,
        ...(system && { system }),
        messages: anthropicMessages,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Anthropic error ${res.status}: ${text}`);
    }

    const data = await res.json();
    const latencyMs = Date.now() - start;
    const usage = data.usage || {};
    const cost = calculateCost(
      modelName,
      usage.input_tokens || 0,
      usage.output_tokens || 0
    );

    return {
      content: data.content?.[0]?.text || "",
      provider: "anthropic",
      model: modelName,
      usage: {
        promptTokens: usage.input_tokens || 0,
        completionTokens: usage.output_tokens || 0,
        totalTokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
      },
      cost,
      latencyMs,
    };
  }

  async *streamCompletion({ messages, model, temperature = 0.7, maxTokens = 4096 }) {
    const modelName = model || this.defaultModel;
    const { system, anthropicMessages } = this._convertMessages(messages);

    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: modelName,
        max_tokens: maxTokens,
        temperature,
        stream: true,
        ...(system && { system }),
        messages: anthropicMessages,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Anthropic stream error ${res.status}: ${text}`);
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
        try {
          const data = JSON.parse(trimmed.slice(6));
          if (data.type === "content_block_delta" && data.delta?.text) {
            yield { text: data.delta.text, done: false };
          }
          if (data.type === "message_stop") {
            yield { text: "", done: true };
          }
          if (data.type === "message_delta" && data.usage) {
            yield {
              text: "",
              done: true,
              usage: {
                promptTokens: 0,
                completionTokens: data.usage.output_tokens || 0,
              },
            };
          }
        } catch {
          // Skip
        }
      }
    }
  }

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
}

module.exports = AnthropicProvider;
