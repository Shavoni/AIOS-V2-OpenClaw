const OpenAI = require("openai");

class ProviderClient {
  constructor({ id, baseUrl, apiKey, defaultModel }) {
    this.id = id;
    this.defaultModel = defaultModel;
    this._healthy = true;
    this._lastError = null;

    this.client = new OpenAI({
      baseURL: baseUrl,
      apiKey: apiKey || "not-needed",
      timeout: 30000,
      maxRetries: 1,
    });
  }

  async complete(messages, options = {}) {
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
}

module.exports = { ProviderClient };