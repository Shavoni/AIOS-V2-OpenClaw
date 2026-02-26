/**
 * Provider auto-detection — discovers LLM providers from environment variables
 * and local services. No external config files needed.
 */

const PROVIDER_DEFAULTS = {
  "lm-studio": {
    name: "LM Studio",
    baseUrl: "http://127.0.0.1:1234/v1",
    priority: 1,
    isLocal: true,
    envKey: "LM_STUDIO_API_KEY",
    envHost: "LM_STUDIO_HOST",
  },
  ollama: {
    name: "Ollama",
    baseUrl: "http://127.0.0.1:11434/v1",
    priority: 2,
    isLocal: true,
    envKey: "OLLAMA_API_KEY",
    envHost: "OLLAMA_HOST",
  },
  openai: {
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    priority: 3,
    isLocal: false,
    envKey: "OPENAI_API_KEY",
  },
  anthropic: {
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    priority: 4,
    isLocal: false,
    envKey: "ANTHROPIC_API_KEY",
  },
  gemini: {
    name: "Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    priority: 5,
    isLocal: false,
    envKey: "GEMINI_API_KEY",
  },
  nvidia: {
    name: "NVIDIA",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    priority: 6,
    isLocal: false,
    envKey: "NVIDIA_API_KEY",
  },
  moonshot: {
    name: "Moonshot",
    baseUrl: "https://api.moonshot.cn/v1",
    priority: 7,
    isLocal: false,
    envKey: "MOONSHOT_API_KEY",
  },
  anythingllm: {
    name: "AnythingLLM",
    baseUrl: "http://127.0.0.1:3001/api/v1",
    priority: 8,
    isLocal: true,
    envKey: "ANYTHINGLLM_API_KEY",
    envHost: "ANYTHINGLLM_HOST",
  },
};

/**
 * Auto-detect available providers:
 * - Local providers (LM Studio, Ollama) are always included (they fail gracefully)
 * - Cloud providers are only included when their API key env var is set
 */
function detectProviders() {
  const providers = [];

  for (const [id, defaults] of Object.entries(PROVIDER_DEFAULTS)) {
    const apiKey = process.env[defaults.envKey] || "";
    const hostOverride = defaults.envHost ? process.env[defaults.envHost] : null;

    // Cloud providers require an API key
    if (!defaults.isLocal && !apiKey) continue;

    const baseUrl = hostOverride
      ? (hostOverride.endsWith("/v1") ? hostOverride : hostOverride + "/v1")
      : defaults.baseUrl;

    providers.push({
      id,
      name: defaults.name,
      baseUrl,
      apiKey: apiKey || "not-needed",
      models: [],
      defaultModel: null,
      isLocal: defaults.isLocal,
      priority: defaults.priority,
      enabled: true,
    });
  }

  // Probe LM Studio for loaded models (sync — fast on localhost)
  const lmStudio = providers.find((p) => p.id === "lm-studio");
  if (lmStudio) {
    try {
      const http = require("http");
      const url = new URL(lmStudio.baseUrl + "/models");
      const data = _syncGet(url);
      if (data && data.data) {
        lmStudio.models = data.data
          .map((m) => m.id)
          .filter((id) => !id.includes("embedding"));
        lmStudio.defaultModel = lmStudio.models[0] || null;
      }
    } catch {
      // LM Studio not running — will fail gracefully at runtime
    }
  }

  return providers.sort((a, b) => a.priority - b.priority);
}

/** Synchronous HTTP GET for localhost model probing at startup */
function _syncGet(url) {
  try {
    const { execSync } = require("child_process");
    const result = execSync(`curl -s "${url.toString()}"`, {
      timeout: 2000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return JSON.parse(result);
  } catch {
    return null;
  }
}

// Legacy compat — parseProviders still works if called externally
function parseProviders(raw) {
  if (!raw || Object.keys(raw).length === 0) return detectProviders();

  const providers = [];
  for (const [id, cfg] of Object.entries(raw)) {
    if (!cfg || typeof cfg !== "object") continue;
    const defaults = PROVIDER_DEFAULTS[id] || {};
    const baseUrl = cfg.baseUrl || cfg.baseURL || cfg.base_url || defaults.baseUrl || null;
    const apiKey = cfg.apiKey || cfg.api_key || process.env[defaults.envKey || ""] || "not-needed";
    const models = Array.isArray(cfg.models)
      ? cfg.models.map((m) => (typeof m === "string" ? m : m.id || m.name))
      : [];

    providers.push({
      id,
      name: cfg.name || defaults.name || id,
      baseUrl,
      apiKey,
      models,
      defaultModel: cfg.defaultModel || cfg.default_model || models[0] || null,
      isLocal: cfg.isLocal || defaults.isLocal || false,
      priority: cfg.priority || defaults.priority || 10,
      enabled: cfg.enabled !== false,
    });
  }

  return providers.sort((a, b) => a.priority - b.priority);
}

module.exports = { detectProviders, parseProviders };
