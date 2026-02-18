class LLMConfig {
  constructor(db, saveFn) {
    this.db = db;
    this.saveFn = saveFn;
  }

  get() {
    const config = this._getRaw();
    return this._maskKeys(config);
  }

  /**
   * Internal: get raw config (with full API keys) for server-side use only.
   */
  _getRaw() {
    const stmt = this.db.prepare(
      "SELECT value FROM system_settings WHERE key = ?"
    );
    stmt.bind(["llm_config"]);
    let config = {};
    if (stmt.step()) {
      try {
        config = JSON.parse(stmt.getAsObject().value);
      } catch {}
    }
    stmt.free();
    return config;
  }

  /**
   * Mask API keys so they're not exposed via the API.
   */
  _maskKeys(config) {
    if (!config || !config.providers) return config;
    const masked = JSON.parse(JSON.stringify(config));
    for (const provider of Object.keys(masked.providers || {})) {
      const p = masked.providers[provider];
      if (p && p.apiKey) {
        const key = p.apiKey;
        p.apiKey = key.length > 8
          ? key.slice(0, 4) + "****" + key.slice(-4)
          : "****";
      }
    }
    return masked;
  }

  update(config) {
    const existing = this.get();
    const merged = { ...existing, ...config };
    const json = JSON.stringify(merged);

    this.db.run(
      `INSERT OR REPLACE INTO system_settings (key, value, updated_at)
       VALUES ('llm_config', ?, datetime('now'))`,
      [json]
    );
    if (this.saveFn) this.saveFn();
    return merged;
  }

  getProviderKey(provider) {
    const config = this._getRaw();
    return config.providers?.[provider]?.apiKey || null;
  }

  setProviderKey(provider, apiKey) {
    const config = this.get();
    if (!config.providers) config.providers = {};
    if (!config.providers[provider]) config.providers[provider] = {};
    config.providers[provider].apiKey = apiKey;
    return this.update(config);
  }

  getDefaultModel() {
    const config = this.get();
    return config.defaultModel || "gpt-4o";
  }

  setDefaultModel(model) {
    return this.update({ defaultModel: model });
  }
}

module.exports = { LLMConfig };
