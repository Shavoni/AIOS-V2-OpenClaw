const { ProviderClient } = require("./provider");
const { FallbackChain } = require("./fallback");

const PROFILE_MODEL_MAP = {
  main: "gpt-4o",
  reasoning: "o3",
  coding: "claude-sonnet-4-5-20250514",
  research: "gemini-2.5-pro",
  local: "gpt-oss-120b",
};

class ModelRouter {
  constructor(providerConfigs) {
    this.clients = new Map();
    this._modelIndex = new Map();

    for (const cfg of providerConfigs) {
      if (cfg.enabled === false) continue;
      const client = new ProviderClient({
        id: cfg.id,
        baseUrl: cfg.baseUrl,
        apiKey: cfg.apiKey,
        defaultModel: cfg.defaultModel,
      });
      this.clients.set(cfg.id, client);
      for (const model of cfg.models || []) {
        this._modelIndex.set(model, client);
      }
    }

    this.fallback = new FallbackChain([...this.clients.values()]);
  }

  async route(messages, options = {}) {
    const model = options.model || PROFILE_MODEL_MAP[options.profile] || PROFILE_MODEL_MAP.main;

    // Try direct model lookup
    const direct = this._modelIndex.get(model);
    if (direct && direct.healthy) {
      try {
        return await direct.complete(messages, { ...options, model });
      } catch (_) {}
    }

    // Fallback chain
    return this.fallback.execute(messages, { ...options, model });
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
        lastError: client.lastError,
        defaultModel: client.defaultModel,
      });
    }
    return status;
  }

  getClient(providerId) {
    return this.clients.get(providerId);
  }
}

module.exports = { ModelRouter, PROFILE_MODEL_MAP };