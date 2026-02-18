const PRIORITY_MAP = {
  openai: 1,
  anthropic: 2,
  gemini: 3,
  moonshot: 4,
  "lm-studio": 5,
  ollama: 6,
  anythingllm: 7,
};

function parseProviders(raw) {
  const providers = [];

  for (const [id, cfg] of Object.entries(raw)) {
    if (!cfg || typeof cfg !== "object") continue;

    const baseUrl = cfg.baseUrl || cfg.baseURL || cfg.base_url || guessBaseUrl(id);
    const apiKey = cfg.apiKey || cfg.api_key || process.env[`${id.toUpperCase().replace(/-/g, "_")}_API_KEY`] || "not-needed";
    const models = Array.isArray(cfg.models)
      ? cfg.models.map((m) => (typeof m === "string" ? m : m.id || m.name))
      : [];

    providers.push({
      id,
      name: cfg.name || id,
      baseUrl,
      apiKey,
      models,
      defaultModel: cfg.defaultModel || cfg.default_model || models[0] || null,
      isLocal: cfg.isLocal || ["lm-studio", "ollama", "anythingllm"].includes(id),
      priority: cfg.priority || PRIORITY_MAP[id] || 10,
      enabled: cfg.enabled !== false,
    });
  }

  return providers.sort((a, b) => a.priority - b.priority);
}

function guessBaseUrl(id) {
  const defaults = {
    openai: "https://api.openai.com/v1",
    anthropic: "https://api.anthropic.com/v1",
    gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
    moonshot: "https://api.moonshot.cn/v1",
    "lm-studio": "http://127.0.0.1:1234/v1",
    ollama: "http://127.0.0.1:11434/v1",
    anythingllm: "http://127.0.0.1:3001/api/v1",
  };
  return defaults[id] || null;
}

module.exports = { parseProviders };