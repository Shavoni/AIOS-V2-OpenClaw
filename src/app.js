const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const config = require("./config-legacy");
const errorHandler = require("./middleware/error-handler");
const { requestLogger, setMetricsService } = require("./middleware/request-logger");
const metricsService = require("./services/metrics-service");
const modelRouter = require("./services/model-router");
const skillEngine = require("./services/skill-engine");
const apiRoutes = require("./routes");

const app = express();

// Wire up metrics
setMetricsService(metricsService);

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
if (config.nodeEnv !== "test") {
  app.use(morgan("dev"));
}
app.use(express.json());
app.use(requestLogger);

// API routes
app.use("/api", apiRoutes);

// Legacy health route (backwards compatible)
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    name: "AIOS V2",
    version: "0.2.0",
    uptime: process.uptime(),
  });
});

// Serve dashboard
app.use(express.static(config.paths.public));

// SPA fallback
app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "Not found" });
  }
  res.sendFile(path.join(config.paths.public, "index.html"));
});

// Error handler
app.use(errorHandler);

// Store services on app for route access
app.set("metricsService", metricsService);
app.set("modelRouter", modelRouter);
app.set("skillEngine", skillEngine);

// Initialize services
modelRouter.initialize().catch((err) => {
  console.error("Model router init error:", err.message);
});
skillEngine.loadSkills().catch((err) => {
  console.error("Skill engine init error:", err.message);
});

metricsService.addActivity("system", "Server started");

module.exports = app;
