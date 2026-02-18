const router = require("express").Router();
const config = require("../config-legacy");

router.get("/", (_req, res) => {
  // Return safe subset of config (no API keys)
  res.json({
    version: "0.2.0",
    nodeEnv: config.nodeEnv,
    providers: Object.keys(config.providers),
    routing: {
      defaultProvider: config.routing.defaultProvider,
      fallbackChain: config.routing.fallbackChain,
    },
    authEnabled: config.auth.apiKeys.length > 0,
  });
});

module.exports = router;
