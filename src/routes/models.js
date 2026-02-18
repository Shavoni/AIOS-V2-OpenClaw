const router = require("express").Router();
const modelRouter = require("../services/model-router");
const metricsService = require("../services/metrics-service");

router.get("/", async (_req, res, next) => {
  try {
    const status = await modelRouter.getProviderStatus();
    const metrics = metricsService.getMetrics();

    res.json({
      providers: status,
      defaultProvider: modelRouter.defaultProvider,
      fallbackChain: modelRouter.fallbackChain,
      usage: metrics.models,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/:provider/test", async (req, res, next) => {
  try {
    const provider = modelRouter.getProvider(req.params.provider);
    if (!provider) {
      return res.status(404).json({ error: `Provider '${req.params.provider}' not found` });
    }

    const start = Date.now();
    const available = await provider.healthCheck();
    const latencyMs = Date.now() - start;
    let models = [];
    if (available) {
      models = await provider.listModels().catch(() => []);
    }

    res.json({
      provider: req.params.provider,
      status: available ? "online" : "offline",
      latencyMs,
      models,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
