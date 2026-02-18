class BaseProvider {
  constructor(name, providerConfig) {
    this.name = name;
    this.config = providerConfig;
    this.available = false;
    this.lastChecked = null;
    this.errorCount = 0;
  }

  async healthCheck() {
    throw new Error("Not implemented");
  }

  async listModels() {
    throw new Error("Not implemented");
  }

  async chatCompletion(_opts) {
    throw new Error("Not implemented");
  }

  async *streamCompletion(_opts) {
    throw new Error("Not implemented");
  }

  calculateCost(_model, _usage) {
    return 0;
  }

  getStatus() {
    return {
      name: this.name,
      available: this.available,
      lastChecked: this.lastChecked,
      errorCount: this.errorCount,
    };
  }
}

module.exports = BaseProvider;
