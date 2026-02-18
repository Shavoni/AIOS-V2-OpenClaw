class MetricsService {
  constructor() {
    this.startTime = Date.now();
    this.requests = { total: 0, byEndpoint: {}, byMethod: {}, byStatus: {} };
    this.models = { totalRequests: 0, totalTokens: 0, totalCost: 0, byProvider: {} };
    this.errors = { total: 0, byType: {} };
    this.chat = { total: 0, totalLatencyMs: 0 };
    this.activity = [];
  }

  recordRequest(method, path, statusCode, durationMs) {
    this.requests.total++;
    this.requests.byMethod[method] = (this.requests.byMethod[method] || 0) + 1;

    const endpoint = this._normalizePath(path);
    // Cap endpoint tracking to prevent unbounded memory growth
    const endpointKeys = Object.keys(this.requests.byEndpoint);
    if (endpointKeys.length < 200 || this.requests.byEndpoint[endpoint]) {
      this.requests.byEndpoint[endpoint] = (this.requests.byEndpoint[endpoint] || 0) + 1;
    }

    const statusGroup = `${statusCode}`;
    this.requests.byStatus[statusGroup] = (this.requests.byStatus[statusGroup] || 0) + 1;
  }

  recordModelUsage(provider, model, tokens, cost, latencyMs) {
    this.models.totalRequests++;
    this.models.totalTokens += tokens;
    this.models.totalCost += cost;

    if (!this.models.byProvider[provider]) {
      this.models.byProvider[provider] = {
        requests: 0,
        tokens: 0,
        cost: 0,
        totalLatencyMs: 0,
      };
    }
    const p = this.models.byProvider[provider];
    p.requests++;
    p.tokens += tokens;
    p.cost += cost;
    p.totalLatencyMs += latencyMs;
  }

  recordChat(latencyMs) {
    this.chat.total++;
    this.chat.totalLatencyMs += latencyMs;
  }

  recordError(type, message) {
    this.errors.total++;
    this.errors.byType[type] = (this.errors.byType[type] || 0) + 1;
  }

  addActivity(type, summary, metadata = {}) {
    this.activity.unshift({
      type,
      summary,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
    if (this.activity.length > 100) {
      this.activity = this.activity.slice(0, 100);
    }
  }

  getMetrics() {
    const uptimeMs = Date.now() - this.startTime;
    const byProvider = {};
    for (const [name, p] of Object.entries(this.models.byProvider)) {
      byProvider[name] = {
        requests: p.requests,
        tokens: p.tokens,
        cost: Math.round(p.cost * 10000) / 10000,
        avgLatencyMs: p.requests > 0 ? Math.round(p.totalLatencyMs / p.requests) : 0,
      };
    }

    return {
      uptime: Math.floor(uptimeMs / 1000),
      timestamp: new Date().toISOString(),
      requests: { ...this.requests },
      models: {
        totalRequests: this.models.totalRequests,
        totalTokens: this.models.totalTokens,
        totalCost: Math.round(this.models.totalCost * 10000) / 10000,
        byProvider,
      },
      errors: { ...this.errors },
      chat: {
        total: this.chat.total,
        avgLatencyMs:
          this.chat.total > 0
            ? Math.round(this.chat.totalLatencyMs / this.chat.total)
            : 0,
      },
      system: {
        memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        nodeVersion: process.version,
      },
    };
  }

  getActivity(limit = 20) {
    return this.activity.slice(0, limit);
  }

  reset() {
    this.startTime = Date.now();
    this.requests = { total: 0, byEndpoint: {}, byMethod: {}, byStatus: {} };
    this.models = { totalRequests: 0, totalTokens: 0, totalCost: 0, byProvider: {} };
    this.errors = { total: 0, byType: {} };
    this.chat = { total: 0, totalLatencyMs: 0 };
    this.activity = [];
  }

  _normalizePath(path) {
    return path
      .replace(/\/api\/memory\/[^/]+/, "/api/memory/:file")
      .replace(/\/api\/skills\/[^/]+/, "/api/skills/:id")
      .replace(/\/api\/models\/[^/]+/, "/api/models/:provider")
      .replace(/\/api\/sessions\/[^/]+/, "/api/sessions/:id")
      .replace(/\/api\/agents\/[^/]+/, "/api/agents/:id")
      .replace(/\/api\/hitl\/approvals\/[^/]+/, "/api/hitl/approvals/:id")
      .replace(/\/api\/audit\/events\/[^/]+/, "/api/audit/events/:id")
      .replace(/\/api\/templates\/[^/]+/, "/api/templates/:id");
  }
}

// Singleton
const metricsService = new MetricsService();

module.exports = metricsService;
