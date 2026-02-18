const config = require("../config-legacy");
const OllamaProvider = require("./providers/ollama");
const LMStudioProvider = require("./providers/lmstudio");
const OpenAIProvider = require("./providers/openai");
const AnthropicProvider = require("./providers/anthropic");
const GeminiProvider = require("./providers/gemini");
const metricsService = require("./metrics-service");

class ModelRouter {
  constructor() {
    this.providers = new Map();
    this.fallbackChain = config.routing.fallbackChain;
    this.defaultProvider = config.routing.defaultProvider;
  }

  async initialize() {
    // Register all configured providers
    this.providers.set("ollama", new OllamaProvider(config.providers.ollama));
    this.providers.set("lmstudio", new LMStudioProvider(config.providers.lmstudio));
    this.providers.set("openai", new OpenAIProvider(config.providers.openai));
    this.providers.set("anthropic", new AnthropicProvider(config.providers.anthropic));
    this.providers.set("gemini", new GeminiProvider(config.providers.gemini));

    // Probe health of all providers (don't await — non-blocking)
    for (const [, provider] of this.providers) {
      provider.healthCheck().catch(() => {});
    }
  }

  async chatCompletion({ messages, model, temperature, maxTokens, stream, provider: preferredProvider }) {
    // Determine provider from model string (e.g., "ollama/llama3" or "openai/gpt-4o")
    let providerName = preferredProvider || this.defaultProvider;
    let modelName = model;

    if (model && model.includes("/")) {
      const [pName, mName] = model.split("/", 2);
      if (this.providers.has(pName)) {
        providerName = pName;
        modelName = mName;
      }
    }

    // Build the chain: preferred provider first, then fallback chain
    const chain = [providerName, ...this.fallbackChain.filter((p) => p !== providerName)];

    let lastError;
    for (const name of chain) {
      const provider = this.providers.get(name);
      if (!provider) continue;

      try {
        if (stream) {
          return {
            provider: name,
            stream: provider.streamCompletion({
              messages,
              model: name === providerName ? modelName : undefined,
              temperature,
              maxTokens,
            }),
          };
        }

        const result = await provider.chatCompletion({
          messages,
          model: name === providerName ? modelName : undefined,
          temperature,
          maxTokens,
        });

        // Record metrics
        metricsService.recordModelUsage(
          result.provider,
          result.model,
          result.usage.totalTokens,
          result.cost,
          result.latencyMs
        );

        return result;
      } catch (err) {
        lastError = err;
        provider.errorCount++;
        metricsService.recordError("ProviderError", `${name}: ${err.message}`);
      }
    }

    throw Object.assign(
      new Error(`All providers failed. Last error: ${lastError?.message}`),
      { statusCode: 502 }
    );
  }

  async getProviderStatus() {
    const status = {};
    for (const [name, provider] of this.providers) {
      await provider.healthCheck().catch(() => {});
      const models = await provider.listModels().catch(() => []);
      status[name] = {
        ...provider.getStatus(),
        models,
        hasApiKey: name === "ollama" || name === "lmstudio"
          ? true
          : Boolean(provider.apiKey),
      };
    }
    return status;
  }

  getProvider(name) {
    return this.providers.get(name);
  }
}

module.exports = new ModelRouter();
