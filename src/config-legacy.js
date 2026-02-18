const path = require("path");

const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",

  providers: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY || "",
      baseUrl: "https://api.openai.com/v1",
      defaultModel: "gpt-4o-mini",
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || "",
      baseUrl: "https://api.anthropic.com",
      defaultModel: "claude-sonnet-4-20250514",
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || "",
      baseUrl: "https://generativelanguage.googleapis.com",
      defaultModel: "gemini-2.0-flash",
    },
    ollama: {
      host: process.env.OLLAMA_HOST || "http://127.0.0.1:11434",
      defaultModel: "llama3",
    },
    lmstudio: {
      host: process.env.LM_STUDIO_HOST || "http://127.0.0.1:1234",
      defaultModel: "default",
    },
  },

  auth: {
    apiKeys: (process.env.API_KEYS || "").split(",").filter(Boolean),
    sessionSecret: process.env.SESSION_SECRET || "aios-v2-dev-secret",
    sessionTtlMs: 24 * 60 * 60 * 1000,
  },

  paths: {
    skills: path.resolve(__dirname, "..", "skills"),
    memory: path.resolve(__dirname, "..", "memory"),
    identity: path.resolve(__dirname, ".."),
    sessions: path.resolve(__dirname, "..", "sessions"),
    public: path.resolve(__dirname, "..", "public"),
  },

  routing: {
    defaultProvider: process.env.DEFAULT_PROVIDER || "ollama",
    fallbackChain: (process.env.FALLBACK_CHAIN || "ollama,openai").split(","),
    complexityThreshold: parseInt(
      process.env.COMPLEXITY_THRESHOLD || "500",
      10
    ),
  },
};

module.exports = config;
