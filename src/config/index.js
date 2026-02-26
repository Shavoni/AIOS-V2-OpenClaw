const path = require("path");
const { detectProviders } = require("./providers");

function loadConfig(projectRoot) {
  const root = projectRoot || path.resolve(__dirname, "../..");

  const providers = detectProviders();
  const fallbackChain = providers
    .filter((p) => p.enabled !== false)
    .sort((a, b) => a.priority - b.priority)
    .map((p) => p.id);

  return Object.freeze({
    port: parseInt(process.env.PORT, 10) || 3000,
    dbPath: process.env.DB_PATH || path.join(root, "data", "aios.db"),
    projectRoot: root,
    providers,
    fallbackChain,
    primaryModel: process.env.PRIMARY_MODEL || "deepseek/deepseek-r1-0528-qwen3-8b",
    logLevel: process.env.LOG_LEVEL || "info",
  });
}

module.exports = { loadConfig };
