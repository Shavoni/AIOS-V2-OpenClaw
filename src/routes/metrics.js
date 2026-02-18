const router = require("express").Router();
const metricsService = require("../services/metrics-service");

router.get("/", (_req, res) => {
  res.json(metricsService.getMetrics());
});

router.get("/activity", (req, res) => {
  const limit = parseInt(req.query.limit || "20", 10);
  res.json(metricsService.getActivity(limit));
});

module.exports = router;
