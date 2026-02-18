const fs = require("fs");
const path = require("path");
const { parseProviders } = require("./providers");

function loadConfig(projectRoot) {
  const root = projectRoot || path.resolve(__dirname, "../..");

  let openclawConfig = {};
  const candidates = [
    path.join(root, ".openclaw", "openclaw.json"),
    path.join(process.env.HOME || process.env.USERPROFILE || "", ".openclaw", "openclaw.json"),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        openclawConfig = JSON.parse(fs.readFileSync(p, "utf-8"));
        break;
      } catch (_) {}
    }
  }

  // OpenClaw stores providers under models.providers
  const rawProviders = openclawConfig.models?.providers || openclawConfig.providers || {};
  const providers = parseProviders(rawProviders);
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
    primaryModel: process.env.PRIMARY_MODEL || "gpt-4o",
    logLevel: process.env.LOG_LEVEL || "info",
  });
}

module.exports = { loadConfig };