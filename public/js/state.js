/**
 * AIOS V2 - Reactive State Store with TTL Cache
 * Lightweight reactive store with key-level subscriptions and data caching.
 */

export class State {
  constructor() {
    this._data = {
      health: null,
      skills: [],
      conversations: [],
      activeConversation: null,
      memoryFiles: [],
      providers: {},
      metrics: {},
      activity: [],
      agents: [],
      approvalSummary: null,
      auditSummary: null,
    };

    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();

    /** @type {Map<string, {data: *, expires: number}>} */
    this._cache = new Map();
  }

  get(key) {
    return this._data[key];
  }

  set(key, value) {
    const prev = this._data[key];
    this._data[key] = value;
    if (prev !== value) {
      this._notify(key, value);
    }
  }

  update(key, updaterFn) {
    const current = this._data[key];
    const next = updaterFn(current);
    this._data[key] = next;
    this._notify(key, next);
  }

  on(key, callback) {
    if (!this._listeners.has(key)) {
      this._listeners.set(key, new Set());
    }
    this._listeners.get(key).add(callback);
    return () => {
      const set = this._listeners.get(key);
      if (set) {
        set.delete(callback);
        if (set.size === 0) this._listeners.delete(key);
      }
    };
  }

  _notify(key, value) {
    const set = this._listeners.get(key);
    if (!set) return;
    for (const cb of set) {
      try { cb(value); } catch (err) {
        console.error(`State: listener error for "${key}"`, err);
      }
    }
  }

  // ─── TTL Cache ──────────────────────────────────────────

  /**
   * Get cached data, or null if expired/missing.
   * @param {string} key
   * @returns {*|null}
   */
  getCached(key) {
    const entry = this._cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this._cache.delete(key);
      return null;
    }
    return entry.data;
  }

  /**
   * Set cached data with TTL.
   * @param {string} key
   * @param {*} data
   * @param {number} ttlMs - Time to live in milliseconds
   */
  setCache(key, data, ttlMs = 30000) {
    this._cache.set(key, { data, expires: Date.now() + ttlMs });
  }

  /**
   * Invalidate a cache entry.
   */
  invalidateCache(key) {
    this._cache.delete(key);
  }

  snapshot() {
    return { ...this._data };
  }
}
