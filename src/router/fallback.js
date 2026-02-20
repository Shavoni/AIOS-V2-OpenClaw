class FallbackChain {
  constructor(providers) {
    this.providers = providers;
    this._failures = new Map();
  }

  async execute(messages, options = {}) {
    const now = Date.now();
    const errors = [];

    for (const provider of this.providers) {
      const lastFail = this._failures.get(provider.id);
      if (lastFail && now - lastFail < 60000) continue;

      try {
        // Use provider's default model if the requested model isn't native to this provider
        const fallbackOptions = { ...options, model: options.model || provider.defaultModel };
        const result = await provider.complete(messages, fallbackOptions);
        // Clear failure record on success so provider is immediately available next time
        this._failures.delete(provider.id);
        return { ...result, attemptCount: errors.length + 1, failedProviders: errors.map((e) => e.id) };
      } catch (err) {
        this._failures.set(provider.id, now);
        errors.push({ id: provider.id, error: err.message });
      }
    }

    throw new Error(`All providers failed: ${errors.map((e) => `${e.id}: ${e.error}`).join("; ")}`);
  }

  async *executeStream(messages, options = {}) {
    const now = Date.now();
    const errors = [];

    for (const provider of this.providers) {
      const lastFail = this._failures.get(provider.id);
      if (lastFail && now - lastFail < 60000) continue;

      try {
        const fallbackOptions = { ...options, model: options.model || provider.defaultModel };
        const stream = provider.completeStream(messages, fallbackOptions);
        const first = await stream.next();
        if (first.done) continue;

        yield first.value;
        for await (const chunk of stream) {
          yield chunk;
        }
        // Clear failure record on success
        this._failures.delete(provider.id);
        return;
      } catch (err) {
        this._failures.set(provider.id, now);
        errors.push({ id: provider.id, error: err.message });
      }
    }

    throw new Error(`All providers failed (stream): ${errors.map((e) => `${e.id}: ${e.error}`).join("; ")}`);
  }

  resetFailures() {
    this._failures.clear();
  }
}

module.exports = { FallbackChain };