const { ProviderClient } = require("./provider");
const { FallbackChain } = require("./fallback");
const { calculateCost } = require("../utils/cost-calculator");
const metricsService = require("../services/metrics-service");

const PROFILE_MODEL_MAP = {
  main: "deepseek/deepseek-r1-0528-qwen3-8b",
  reasoning: "deepseek/deepseek-r1-0528-qwen3-8b",
  coding: "deepseek/deepseek-r1-0528-qwen3-8b",
  research: "deepseek/deepseek-r1-0528-qwen3-8b",
  local: "deepseek/deepseek-r1-0528-qwen3-8b",
};

class ModelRouter {
  constructor(providerConfigs) {
    this.clients = new Map();
    this._modelIndex = new Map();
    this._providerModels = new Map();

    for (const cfg of providerConfigs) {
      if (cfg.enabled === false) continue;
      const client = new ProviderClient({
        id: cfg.id,
        baseUrl: cfg.baseUrl,
        apiKey: cfg.apiKey,
        defaultModel: cfg.defaultModel,
      });
      this.clients.set(cfg.id, client);
      this._providerModels.set(cfg.id, cfg.models || []);
      for (const model of cfg.models || []) {
        this._modelIndex.set(model, client);
      }
    }

    this.fallback = new FallbackChain([...this.clients.values()]);
  }

  async route(messages, options = {}) {
    const model = options.model || PROFILE_MODEL_MAP[options.profile] || PROFILE_MODEL_MAP.main;

    let result;

    // Try direct model lookup
    const direct = this._modelIndex.get(model);
    if (direct && direct.healthy) {
      try {
        result = await direct.complete(messages, { ...options, model });
      } catch (_) {
        // Fall through to fallback chain
      }
    }

    // Fallback chain
    if (!result) {
      result = await this.fallback.execute(messages, { ...options, model });
    }

    // Record cost and metrics
    this._recordMetrics(result);

    return result;
  }

  async *routeStream(messages, options = {}) {
    const model = options.model || PROFILE_MODEL_MAP[options.profile] || PROFILE_MODEL_MAP.main;

    const direct = this._modelIndex.get(model);
    if (direct && direct.healthy) {
      try {
        for await (const chunk of direct.completeStream(messages, { ...options, model })) {
          yield chunk;
        }
        return;
      } catch (_) {}
    }

    for await (const chunk of this.fallback.executeStream(messages, { ...options, model })) {
      yield chunk;
    }
  }

  getProviderStatus() {
    const status = [];
    for (const [id, client] of this.clients) {
      status.push({
        id,
        healthy: client.healthy,
        status: client.healthy ? 'online' : 'offline',
        lastError: client.lastError,
        defaultModel: client.defaultModel,
        models: this._providerModels.get(id) || [],
      });
    }
    return status;
  }

  getClient(providerId) {
    return this.clients.get(providerId);
  }

  _recordMetrics(result) {
    if (!result || !result.usage) return;
    const totalTokens = (result.usage.prompt || 0) + (result.usage.completion || 0);
    const cost = calculateCost(result.model, result.usage.prompt || 0, result.usage.completion || 0);
    result.cost = cost;
    metricsService.recordModelUsage(
      result.provider,
      result.model,
      totalTokens,
      cost,
      result.latencyMs || 0
    );
  }
}

module.exports = { ModelRouter, PROFILE_MODEL_MAP };
