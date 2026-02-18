/**
 * AIOS V2 - API Client
 * Handles all fetch calls to the backend, updates reactive state store.
 * Supports JWT auth (optional — dev mode works without login).
 */

export class API {
  /**
   * @param {import('./state.js').State} state - Reactive state store
   */
  constructor(state) {
    this.state = state;
    this._healthInterval = null;
    this._uptimeInterval = null;
    this._bootTime = null;
    this._accessToken = localStorage.getItem('aios_token') || null;
    this._refreshToken = localStorage.getItem('aios_refresh') || null;
  }

  // ─── Auth ──────────────────────────────────────────────

  get isAuthenticated() {
    return !!this._accessToken;
  }

  get authHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this._accessToken) {
      headers['Authorization'] = `Bearer ${this._accessToken}`;
    }
    return headers;
  }

  setTokens(accessToken, refreshToken) {
    this._accessToken = accessToken;
    this._refreshToken = refreshToken;
    if (accessToken) {
      localStorage.setItem('aios_token', accessToken);
    } else {
      localStorage.removeItem('aios_token');
    }
    if (refreshToken) {
      localStorage.setItem('aios_refresh', refreshToken);
    } else {
      localStorage.removeItem('aios_refresh');
    }
  }

  clearTokens() {
    this.setTokens(null, null);
    this.state.set('currentUser', null);
  }

  async login(username, password) {
    const result = await this._post('/api/auth/login', { username, password });
    if (result.accessToken) {
      this.setTokens(result.accessToken, result.refreshToken);
      this.state.set('currentUser', result.user || { username, role: result.role });
    }
    return result;
  }

  async register(username, password, opts = {}) {
    return this._post('/api/auth/register', { username, password, ...opts });
  }

  async refreshAccessToken() {
    if (!this._refreshToken) return false;
    try {
      const result = await this._post('/api/auth/refresh', { refreshToken: this._refreshToken });
      if (result.accessToken) {
        this.setTokens(result.accessToken, result.refreshToken || this._refreshToken);
        return true;
      }
    } catch {
      this.clearTokens();
    }
    return false;
  }

  async checkAuthStatus() {
    try {
      const status = await this._get('/api/auth/status');
      if (status.authenticated && status.user) {
        this.state.set('currentUser', status.user);
      } else if (status.authenticated && !status.authRequired) {
        this.state.set('currentUser', { username: 'dev', role: 'admin', devMode: true });
      }
      this.state.set('authRequired', status.authRequired);
      return status;
    } catch {
      return { authenticated: false, authRequired: false };
    }
  }

  async logout() {
    try { await this._post('/api/auth/logout', {}); } catch { /* ignore */ }
    this.clearTokens();
  }

  // ─── Health ──────────────────────────────────────────────

  async fetchHealth() {
    const data = await this._get('/api/health');
    this.state.set('health', data);
    if (data && data.uptime !== undefined && !this._bootTime) {
      this._bootTime = Date.now() - data.uptime * 1000;
    }
    return data;
  }

  startHealthPolling(interval = 30000) {
    this.stopHealthPolling();
    this.fetchHealth().catch((err) => console.warn('Health poll initial fetch failed:', err));
    this._healthInterval = setInterval(() => {
      this.fetchHealth().catch((err) => console.warn('Health poll failed:', err));
    }, interval);
    this._uptimeInterval = setInterval(() => {
      const health = this.state.get('health');
      if (health && this._bootTime) {
        const uptimeSeconds = Math.floor((Date.now() - this._bootTime) / 1000);
        this.state.set('health', { ...health, uptime: uptimeSeconds });
      }
    }, 10000);
  }

  stopHealthPolling() {
    if (this._healthInterval) { clearInterval(this._healthInterval); this._healthInterval = null; }
    if (this._uptimeInterval) { clearInterval(this._uptimeInterval); this._uptimeInterval = null; }
  }

  // ─── Chat ────────────────────────────────────────────────

  async sendMessage(conversationId, message, model = 'auto') {
    return this._post('/api/chat', { conversationId, message, model });
  }

  async sendMessageStream(conversationId, message, model, onChunk) {
    // Cancel any in-flight stream request
    if (this._streamController) {
      this._streamController.abort();
    }
    this._streamController = new AbortController();

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: this.authHeaders,
      body: JSON.stringify({ conversationId, message, model, stream: true }),
      signal: this._streamController.signal,
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error || `HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let currentEvent = '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('event:')) { currentEvent = trimmed.slice(6).trim(); continue; }
        if (trimmed.startsWith('data:')) {
          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') return;
          try {
            const data = JSON.parse(dataStr);
            if (currentEvent === 'error') throw new Error(data.error || 'Stream error');
            if (data.content || data.text || data.chunk) {
              onChunk(data.content || data.text || data.chunk);
            } else if (typeof data === 'string') { onChunk(data); }
          } catch (parseErr) {
            if (dataStr && dataStr !== '[DONE]' && !parseErr.message.includes('Stream error')) {
              onChunk(dataStr);
            } else if (parseErr.message.includes('Stream error')) { throw parseErr; }
          }
          currentEvent = '';
        }
      }
    }
  }

  async fetchConversations() { return this._get('/api/chat/conversations'); }

  async deleteConversation(id) {
    return this._delete(`/api/sessions/${encodeURIComponent(id)}`);
  }

  // ─── Skills ──────────────────────────────────────────────

  async fetchSkills() {
    const data = await this._get('/api/skills');
    this.state.set('skills', data || []);
    return data;
  }

  async fetchSkillDetail(id) { return this._get(`/api/skills/${encodeURIComponent(id)}`); }

  async executeSkill(id, command, args = {}) {
    return this._post(`/api/skills/${encodeURIComponent(id)}/execute`, { command, args });
  }

  // ─── Memory ──────────────────────────────────────────────

  async fetchMemoryFiles() {
    const data = await this._get('/api/memory');
    this.state.set('memoryFiles', data || []);
    return data;
  }

  async fetchMemoryFile(filename) { return this._get(`/api/memory/${encodeURIComponent(filename)}`); }

  async saveMemoryFile(filename, content) { return this._post('/api/memory', { filename, content }); }

  async searchMemory(query) { return this._get(`/api/memory/search?q=${encodeURIComponent(query)}`); }

  // ─── Models/Providers ────────────────────────────────────

  async fetchProviders() {
    const data = await this._get('/api/models');
    this.state.set('providers', data || {});
    return data;
  }

  async testProvider(name) { return this._post(`/api/models/${encodeURIComponent(name)}/test`, {}); }

  // ─── Metrics ─────────────────────────────────────────────

  async fetchMetrics() {
    const data = await this._get('/api/metrics');
    this.state.set('metrics', data || {});
    return data;
  }

  async fetchActivity(limit = 50) {
    const data = await this._get(`/api/metrics/activity?limit=${limit}`);
    this.state.set('activity', data || []);
    return data;
  }

  // ─── Config ──────────────────────────────────────────────

  async fetchConfig() { return this._get('/api/config'); }

  // ─── Helpers ─────────────────────────────────────────────

  async _get(path) {
    try {
      const response = await fetch(path, { headers: this.authHeaders });
      if (response.status === 401 && this._refreshToken) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          const retry = await fetch(path, { headers: this.authHeaders });
          if (!retry.ok) { const err = await retry.json().catch(() => ({})); throw new Error(err.error || `GET ${path} failed: ${retry.status}`); }
          return retry.json();
        }
      }
      if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error || `GET ${path} failed: ${response.status}`); }
      return response.json();
    } catch (err) {
      console.error(`API GET ${path}:`, err);
      throw err;
    }
  }

  async _post(path, body) {
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: this.authHeaders,
        body: JSON.stringify(body),
      });
      if (response.status === 401 && this._refreshToken) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          const retry = await fetch(path, { method: 'POST', headers: this.authHeaders, body: JSON.stringify(body) });
          if (!retry.ok) { const err = await retry.json().catch(() => ({})); throw new Error(err.error || `POST ${path} failed: ${retry.status}`); }
          return retry.json();
        }
      }
      if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error || `POST ${path} failed: ${response.status}`); }
      return response.json();
    } catch (err) {
      console.error(`API POST ${path}:`, err);
      throw err;
    }
  }

  async _put(path, body) {
    try {
      const response = await fetch(path, {
        method: 'PUT',
        headers: this.authHeaders,
        body: JSON.stringify(body),
      });
      if (response.status === 401 && this._refreshToken) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          const retry = await fetch(path, { method: 'PUT', headers: this.authHeaders, body: JSON.stringify(body) });
          if (!retry.ok) { const err = await retry.json().catch(() => ({})); throw new Error(err.error || `PUT ${path} failed: ${retry.status}`); }
          return retry.json();
        }
      }
      if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error || `PUT ${path} failed: ${response.status}`); }
      return response.json();
    } catch (err) {
      console.error(`API PUT ${path}:`, err);
      throw err;
    }
  }

  async _delete(path) {
    try {
      const response = await fetch(path, { method: 'DELETE', headers: this.authHeaders });
      if (response.status === 401 && this._refreshToken) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          const retry = await fetch(path, { method: 'DELETE', headers: this.authHeaders });
          if (!retry.ok) { const err = await retry.json().catch(() => ({})); throw new Error(err.error || `DELETE ${path} failed: ${retry.status}`); }
          return retry.json();
        }
      }
      if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error || `DELETE ${path} failed: ${response.status}`); }
      return response.json();
    } catch (err) {
      console.error(`API DELETE ${path}:`, err);
      throw err;
    }
  }
}
