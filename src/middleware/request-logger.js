let metricsService = null;

function setMetricsService(service) {
  metricsService = service;
}

function requestLogger(req, res, next) {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (metricsService) {
      metricsService.recordRequest(req.method, req.path, res.statusCode, duration);
    }
  });

  next();
}

module.exports = { requestLogger, setMetricsService };
