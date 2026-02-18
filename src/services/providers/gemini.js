const BaseProvider = require("./base-provider");
const { calculateCost } = require("../../utils/cost-calculator");

class GeminiProvider extends BaseProvider {
  constructor(providerConfig) {
    super("gemini", providerConfig);
    this.apiKey = providerConfig.apiKey;
    this.baseUrl = providerConfig.baseUrl;
    this.defaultModel = providerConfig.defaultModel || "gemini-2.0-flash";
  }

  async healthCheck() {
    if (!this.apiKey) {
      this.available = false;
      this.lastChecked = Date.now();
      return false;
    }
    try {
      const res = await fetch(
        `${this.baseUrl}/v1beta/models?key=${this.apiKey}`
      );
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
      const res = await fetch(
        `${this.baseUrl}/v1beta/models?key=${this.apiKey}`
      );
      if (!res.ok) return [];
      const data = await res.json();
      return (data.models || [])
        .filter((m) => m.name.includes("gemini"))
        .map((m) => m.name.replace("models/", ""));
    } catch {
      return [];
    }
  }

  async chatCompletion({ messages, model, temperature = 0.7, maxTokens }) {
    const modelName = model || this.defaultModel;
    const start = Date.now();

    const { systemInstruction, contents } = this._convertMessages(messages);

    const res = await fetch(
      `${this.baseUrl}/v1beta/models/${modelName}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(systemInstruction && { systemInstruction }),
          contents,
          generationConfig: {
            temperature,
            ...(maxTokens && { maxOutputTokens: maxTokens }),
          },
        }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gemini error ${res.status}: ${text}`);
    }

    const data = await res.json();
    const latencyMs = Date.now() - start;
    const content =
      data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const usageMeta = data.usageMetadata || {};
    const cost = calculateCost(
      modelName,
      usageMeta.promptTokenCount || 0,
      usageMeta.candidatesTokenCount || 0
    );

    return {
      content,
      provider: "gemini",
      model: modelName,
      usage: {
        promptTokens: usageMeta.promptTokenCount || 0,
        completionTokens: usageMeta.candidatesTokenCount || 0,
        totalTokens: usageMeta.totalTokenCount || 0,
      },
      cost,
      latencyMs,
    };
  }

  async *streamCompletion({ messages, model, temperature = 0.7, maxTokens }) {
    const modelName = model || this.defaultModel;
    const { systemInstruction, contents } = this._convertMessages(messages);

    const res = await fetch(
      `${this.baseUrl}/v1beta/models/${modelName}:streamGenerateContent?key=${this.apiKey}&alt=sse`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(systemInstruction && { systemInstruction }),
          contents,
          generationConfig: {
            temperature,
            ...(maxTokens && { maxOutputTokens: maxTokens }),
          },
        }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gemini stream error ${res.status}: ${text}`);
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
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (text) {
            yield { text, done: false };
          }
        } catch {
          // Skip
        }
      }
    }
    yield { text: "", done: true };
  }

  _convertMessages(messages) {
    let systemText = "";
    const contents = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        systemText += (systemText ? "\n\n" : "") + msg.content;
      } else {
        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        });
      }
    }

    const systemInstruction = systemText
      ? { parts: [{ text: systemText }] }
      : undefined;

    return { systemInstruction, contents };
  }
}

module.exports = GeminiProvider;
