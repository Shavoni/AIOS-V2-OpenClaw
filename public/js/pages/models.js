/**
 * AIOS V2 - Models Page (V1-Level Polish)
 * Gradient header, total stats row, enhanced provider cards with gradient icons,
 * model search, connection history, styled routing config with fallback chain.
 */

import { showToast } from '../components/toast.js';
import { escapeHtml, formatCost, formatTokens, formatRelative, debounce, $ } from '../utils.js';

/* --------------------------------------------------------------------------
   Constants
   -------------------------------------------------------------------------- */

const PROVIDER_META = {
  ollama: {
    label: 'Ollama',
    desc: 'Local open-source models',
    color: '#3b82f6',
    gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    dim: 'rgba(59,130,246,0.15)',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="4"/>
    </svg>`,
  },
  lmstudio: {
    label: 'LM Studio',
    desc: 'Local LLM inference server',
    color: '#8b5cf6',
    gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
    dim: 'rgba(139,92,246,0.15)',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="3" y="3" width="18" height="18" rx="3"/>
      <path d="M8 12h8M12 8v8"/>
    </svg>`,
  },
  openai: {
    label: 'OpenAI',
    desc: 'GPT-4, GPT-3.5, and more',
    color: '#22c55e',
    gradient: 'linear-gradient(135deg, #22c55e, #16a34a)',
    dim: 'rgba(34,197,94,0.15)',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M12 2L2 7v10l10 5 10-5V7L12 2z"/>
      <path d="M12 22V12M2 7l10 5M22 7l-10 5"/>
    </svg>`,
  },
  anthropic: {
    label: 'Anthropic',
    desc: 'Claude models',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    dim: 'rgba(245,158,11,0.15)',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
      <path d="M8 14l4-8 4 8"/>
      <line x1="9" y1="12" x2="15" y2="12"/>
    </svg>`,
  },
  gemini: {
    label: 'Gemini',
    desc: 'Google AI models',
    color: '#ef4444',
    gradient: 'linear-gradient(135deg, #ef4444, #dc2626)',
    dim: 'rgba(239,68,68,0.15)',
    icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 2c-3 4-3 8 0 10s3 6 0 10"/>
      <path d="M2 12c4-3 8-3 10 0s6 3 10 0"/>
    </svg>`,
  },
};

const ICONS = {
  models: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0022 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  search: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="7" r="5"/><path d="M11 11l3 3"/></svg>`,
  routing: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="4" cy="10" r="2"/><circle cx="16" cy="4" r="2"/><circle cx="16" cy="16" r="2"/><path d="M6 10h4l2-6M10 10l2 6"/></svg>`,
  check: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 7 6 10 11 4"/></svg>`,
  cross: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="3" x2="11" y2="11"/><line x1="11" y1="3" x2="3" y2="11"/></svg>`,
  arrow: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 8h10M10 5l3 3-3 3"/></svg>`,
  clock: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="6" cy="6" r="5"/><polyline points="6,3 6,6 8,7"/></svg>`,
};

/** In-memory connection history: { [providerKey]: Array<{ timestamp, success, latency?, error? }> } */
const connectionHistory = {};

/** Maximum history entries per provider */
const MAX_HISTORY = 5;

/* --------------------------------------------------------------------------
   ModelsPage Class
   -------------------------------------------------------------------------- */

export class ModelsPage {
  /**
   * @param {Object} app - App instance with state, api, router
   */
  constructor(app) {
    this.state = app.state;
    this.api = app.api;
    this.router = app.router;
    this._unsubs = [];
    this._searchTerm = '';
  }

  /**
   * Render the models page into the mount element.
   * @param {HTMLElement} mount
   * @returns {Function} Cleanup function
   */
  render(mount) {
    mount.innerHTML = `
      <div class="page page-models">
        <!-- Gradient Header -->
        <div class="page-gradient-header" style="background: var(--gradient-models)">
          <div class="page-header-content">
            <h1 class="page-title">
              <span class="page-title-icon">${ICONS.models}</span>
              Models &amp; Providers
            </h1>
            <p class="page-subtitle">Manage AI provider connections, models, and intelligent routing</p>
          </div>
        </div>

        <!-- Total Stats Row -->
        <section class="stat-grid" id="models-stats"></section>

        <!-- Model Search -->
        <div class="models-search-bar" style="margin-bottom:var(--space-6)">
          <div class="search-input-wrapper" style="position:relative;max-width:480px">
            <span class="search-icon-inline" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-muted);pointer-events:none">${ICONS.search}</span>
            <input
              type="text"
              class="input"
              id="model-search-input"
              placeholder="Search models across all providers..."
              autocomplete="off"
              style="padding-left:36px"
            />
          </div>
        </div>

        <!-- Provider Cards Grid -->
        <div class="models-grid" id="models-grid">
          <div class="loader-overlay" style="min-height:200px"><div class="spinner"></div><span class="text-secondary">Loading providers...</span></div>
        </div>

        <!-- Routing Configuration -->
        <section class="routing-config glass-card glass-card--static" id="routing-config" style="margin-top:var(--space-8)">
          <div class="routing-config-header" style="display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-6)">
            <div style="width:40px;height:40px;border-radius:var(--radius-md);background:var(--accent-blue-dim);display:flex;align-items:center;justify-content:center;color:var(--accent-blue)">${ICONS.routing}</div>
            <div>
              <h2 class="section-title" style="margin:0;border:none;padding:0">Routing Configuration</h2>
              <p style="font-size:var(--font-size-xs);color:var(--text-muted);margin:2px 0 0">Provider priority, strategy, and fallback chain</p>
            </div>
          </div>
          <div class="routing-details" id="routing-details">
            <div class="loader-overlay" style="min-height:100px"><div class="spinner spinner--sm"></div></div>
          </div>
        </section>
      </div>
    `;

    // Bind search
    this._bindSearch();

    // Subscribe to state
    const unsubProviders = this.state.on('providers', () => this._renderAll());
    this._unsubs.push(unsubProviders);

    const unsubMetrics = this.state.on('metrics', () => this._renderAll());
    this._unsubs.push(unsubMetrics);

    // Fetch data
    this._fetchData();

    return () => this._cleanup();
  }

  /* ========================================================================
     Data Fetching
     ======================================================================== */

  /**
   * Fetch providers, metrics, and routing config.
   * @private
   */
  async _fetchData() {
    try {
      await Promise.all([
        this.api.fetchProviders(),
        this.api.fetchMetrics().catch(() => {}),
        this._fetchRoutingConfig(),
      ]);
    } catch (err) {
      const grid = document.getElementById('models-grid');
      if (grid) {
        grid.innerHTML = `
          <div class="empty-state">
            <p class="error-text">Failed to load providers: ${escapeHtml(err.message)}</p>
            <button class="btn btn-sm btn-primary" id="models-retry-btn">Retry</button>
          </div>
        `;
        const retryBtn = document.getElementById('models-retry-btn');
        if (retryBtn) retryBtn.addEventListener('click', () => this._fetchData());
      }
    }
  }

  /**
   * Fetch and render routing config.
   * @private
   */
  async _fetchRoutingConfig() {
    const detailsEl = document.getElementById('routing-details');
    if (!detailsEl) return;

    try {
      const config = await this.api.fetchConfig();
      const routing = config?.routing || config?.router || {};
      this._renderRoutingConfig(detailsEl, routing);
    } catch {
      this._renderRoutingConfig(detailsEl, {});
    }
  }

  /* ========================================================================
     Search
     ======================================================================== */

  _bindSearch() {
    const input = document.getElementById('model-search-input');
    if (!input) return;

    const handleSearch = debounce(() => {
      this._searchTerm = input.value.trim().toLowerCase();
      this._renderProviders();
    }, 200);

    input.addEventListener('input', handleSearch);
  }

  /* ========================================================================
     Master Render
     ======================================================================== */

  _renderAll() {
    this._renderStats();
    this._renderProviders();
  }

  /* ========================================================================
     Stats Row
     ======================================================================== */

  _renderStats() {
    const container = document.getElementById('models-stats');
    if (!container) return;

    const providers = this.state.get('providers') || {};
    const metrics = this.state.get('metrics') || {};
    const providerList = this._normalizeProviders(providers);

    const totalProviders = providerList.length || Object.keys(PROVIDER_META).length;
    const onlineProviders = providerList.filter(
      (p) => p.status === 'online' || p.available === true
    ).length;

    // Count total models across all providers
    let totalModels = 0;
    providerList.forEach((p) => {
      const models = p.models || [];
      totalModels += models.length;
    });

    // Sum total cost
    let totalCost = 0;
    const byProvider = metrics.byProvider || metrics || {};
    Object.keys(PROVIDER_META).forEach((key) => {
      const pm = byProvider[key] || {};
      totalCost += pm.cost || pm.totalCost || 0;
    });

    container.innerHTML = `
      <div class="stat-card glass-card stagger-item">
        <div class="stat-label">Total Providers</div>
        <div class="stat-value stat-value--blue">${totalProviders}</div>
      </div>
      <div class="stat-card glass-card stagger-item">
        <div class="stat-label">Online</div>
        <div class="stat-value stat-value--green">${onlineProviders}</div>
      </div>
      <div class="stat-card glass-card stagger-item">
        <div class="stat-label">Models Available</div>
        <div class="stat-value stat-value--purple">${totalModels}</div>
      </div>
      <div class="stat-card glass-card stagger-item">
        <div class="stat-label">Total Cost</div>
        <div class="stat-value stat-value--orange">${formatCost(totalCost)}</div>
      </div>
    `;
  }

  /* ========================================================================
     Provider Cards
     ======================================================================== */

  _renderProviders() {
    const grid = document.getElementById('models-grid');
    if (!grid) return;

    const providers = this.state.get('providers') || {};
    const metrics = this.state.get('metrics') || {};
    const providerList = this._normalizeProviders(providers);

    const renderList =
      providerList.length > 0
        ? providerList
        : Object.keys(PROVIDER_META).map((k) => ({ name: k, status: 'unknown' }));

    // Filter by search if active
    const filtered = this._searchTerm
      ? renderList.filter((p) => {
          const key = (p.name || p.provider || '').toLowerCase();
          const meta = PROVIDER_META[key];
          const models = p.models || [];
          // Match provider name/label
          if (key.includes(this._searchTerm)) return true;
          if (meta && meta.label.toLowerCase().includes(this._searchTerm)) return true;
          // Match any model name
          return models.some((m) => {
            const name = (typeof m === 'string' ? m : m.name || m.id || '').toLowerCase();
            return name.includes(this._searchTerm);
          });
        })
      : renderList;

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;padding:var(--space-8)">
          <p class="empty-state-title">No matching providers or models</p>
          <p class="empty-state-desc">Try a different search term.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered
      .map((p) => {
        const key = (p.name || p.provider || '').toLowerCase();
        const meta = PROVIDER_META[key] || {
          label: p.name || key,
          desc: '',
          color: '#6366f1',
          gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)',
          dim: 'rgba(99,102,241,0.15)',
          icon: PROVIDER_META.ollama.icon,
        };
        const providerMetrics = metrics.byProvider?.[key] || metrics[key] || {};
        return this._buildProviderCardHtml(key, meta, p, providerMetrics);
      })
      .join('');

    // Bind test buttons
    grid.querySelectorAll('.test-connection-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const name = btn.getAttribute('data-provider');
        await this._testConnection(name, btn);
      });
    });

    // Bind history toggle buttons
    grid.querySelectorAll('.toggle-history-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-provider');
        const panel = document.getElementById(`history-panel-${name}`);
        if (panel) {
          const isHidden = panel.style.display === 'none';
          panel.style.display = isHidden ? '' : 'none';
          btn.textContent = isHidden ? 'Hide History' : 'History';
        }
      });
    });
  }

  /**
   * Normalize provider data into a consistent array.
   * @private
   */
  _normalizeProviders(providers) {
    if (Array.isArray(providers.providers)) {
      return providers.providers;
    }
    if (Array.isArray(providers)) {
      return providers;
    }

    const knownKeys = Object.keys(PROVIDER_META);
    const result = [];
    for (const key of knownKeys) {
      if (providers[key]) {
        result.push({ name: key, ...providers[key] });
      }
    }
    if (result.length === 0 && Object.keys(providers).length === 0) {
      return knownKeys.map((k) => ({ name: k, status: 'unknown' }));
    }
    return result.length ? result : knownKeys.map((k) => ({ name: k, status: 'unknown' }));
  }

  /**
   * Build a single provider card HTML.
   * @private
   */
  _buildProviderCardHtml(key, meta, providerData, providerMetrics) {
    const status = providerData.status || (providerData.available ? 'online' : 'unknown');
    const isOnline = status === 'online';
    const isOffline = status === 'offline';

    const statusClass = isOnline ? 'online' : isOffline ? 'offline' : 'unknown';
    const statusLabel = isOnline ? 'Online' : isOffline ? 'Offline' : 'Unknown';

    // Models list with optional search highlighting
    const models = providerData.models || [];
    const filteredModels = this._searchTerm
      ? models.filter((m) => {
          const name = (typeof m === 'string' ? m : m.name || m.id || '').toLowerCase();
          return name.includes(this._searchTerm);
        })
      : models;

    const modelListHtml = filteredModels.length
      ? filteredModels
          .slice(0, 10)
          .map((m) => {
            const name = typeof m === 'string' ? m : m.name || m.id;
            return `<span class="model-tag">${escapeHtml(name)}</span>`;
          })
          .join('') +
        (filteredModels.length > 10
          ? `<span class="model-tag" style="background:var(--bg-tertiary);color:var(--text-muted)">+${filteredModels.length - 10} more</span>`
          : '')
      : '<span style="font-size:var(--font-size-xs);color:var(--text-muted)">No models detected</span>';

    // Metrics
    const requests = providerMetrics.requests || providerMetrics.totalRequests || 0;
    const tokens = providerMetrics.tokens || providerMetrics.totalTokens || 0;
    const cost = providerMetrics.cost || providerMetrics.totalCost || 0;
    const latency = providerMetrics.avgLatency || providerData.latency || 0;

    // Connection history
    const history = connectionHistory[key] || [];
    const hasHistory = history.length > 0;

    const historyHtml = hasHistory
      ? `
        <div class="provider-history-panel" id="history-panel-${escapeHtml(key)}" style="display:none">
          <div style="font-size:var(--font-size-xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:var(--space-2)">Connection History</div>
          ${history
            .map(
              (h) => `
            <div style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-1) 0;font-size:var(--font-size-xs)">
              <span style="color:${h.success ? 'var(--accent-green)' : 'var(--accent-red)'};flex-shrink:0">${h.success ? ICONS.check : ICONS.cross}</span>
              <span style="color:var(--text-secondary);flex:1">${h.success ? 'Connected' : escapeHtml(h.error || 'Failed')}${h.latency ? ` (${h.latency}ms)` : ''}</span>
              <span style="color:var(--text-muted);flex-shrink:0">${ICONS.clock} ${escapeHtml(this._formatTimestamp(h.timestamp))}</span>
            </div>
          `
            )
            .join('')}
        </div>
      `
      : '';

    return `
      <div class="model-provider-card glass-card stagger-item" data-provider="${escapeHtml(key)}">
        <!-- Card Top with Provider Gradient -->
        <div class="provider-card-top" style="background:${meta.gradient};margin:calc(-1 * var(--space-6)) calc(-1 * var(--space-6)) 0;padding:var(--space-5) var(--space-6);border-radius:var(--radius-lg) var(--radius-lg) 0 0;position:relative">
          <div style="display:flex;align-items:center;gap:var(--space-4)">
            <div class="provider-icon-box" style="width:52px;height:52px;border-radius:var(--radius-md);background:rgba(255,255,255,0.2);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0">
              ${meta.icon}
            </div>
            <div style="flex:1;min-width:0">
              <h3 style="color:#fff;font-size:var(--font-size-lg);font-weight:var(--font-weight-bold);margin:0;line-height:1.2">${escapeHtml(meta.label)}</h3>
              <p style="color:rgba(255,255,255,0.75);font-size:var(--font-size-xs);margin:4px 0 0">${escapeHtml(meta.desc)}</p>
            </div>
            <div class="provider-status-indicator" style="display:flex;align-items:center;gap:var(--space-2)">
              <span class="provider-status-dot provider-status-dot--${statusClass}" style="width:10px;height:10px;border-radius:50%;background:${isOnline ? '#4ade80' : isOffline ? '#f87171' : 'rgba(255,255,255,0.4)'};${isOnline ? 'box-shadow:0 0 8px rgba(74,222,128,0.6);animation:pulseDot 2s ease-in-out infinite' : ''}"></span>
              <span style="color:rgba(255,255,255,0.9);font-size:var(--font-size-xs);font-weight:var(--font-weight-medium)">${statusLabel}</span>
            </div>
          </div>
        </div>

        <!-- Models Section -->
        <div class="provider-models-section" style="margin-top:var(--space-5)">
          <h4 style="font-size:var(--font-size-xs);text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);margin:0 0 var(--space-2)">Models <span style="color:var(--text-dim)">(${models.length})</span></h4>
          <div class="provider-model-list" style="display:flex;flex-wrap:wrap;gap:var(--space-2)">${modelListHtml}</div>
        </div>

        <!-- Stats Row -->
        <div class="provider-stats-row" style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--space-3);border-top:1px solid var(--border-subtle);padding-top:var(--space-4);margin-top:var(--space-4)">
          <div class="provider-stat" style="text-align:center">
            <span class="stat-value" style="font-size:var(--font-size-md);font-weight:var(--font-weight-bold);color:var(--text-white);display:block;font-family:var(--font-mono)">${requests.toLocaleString()}</span>
            <span class="stat-label" style="font-size:var(--font-size-xs);color:var(--text-muted)">Requests</span>
          </div>
          <div class="provider-stat" style="text-align:center">
            <span class="stat-value" style="font-size:var(--font-size-md);font-weight:var(--font-weight-bold);color:var(--text-white);display:block;font-family:var(--font-mono)">${formatTokens(tokens)}</span>
            <span class="stat-label" style="font-size:var(--font-size-xs);color:var(--text-muted)">Tokens</span>
          </div>
          <div class="provider-stat" style="text-align:center">
            <span class="stat-value" style="font-size:var(--font-size-md);font-weight:var(--font-weight-bold);color:var(--text-white);display:block;font-family:var(--font-mono)">${formatCost(cost)}</span>
            <span class="stat-label" style="font-size:var(--font-size-xs);color:var(--text-muted)">Cost</span>
          </div>
          <div class="provider-stat" style="text-align:center">
            <span class="stat-value" style="font-size:var(--font-size-md);font-weight:var(--font-weight-bold);color:var(--text-white);display:block;font-family:var(--font-mono)">${latency ? latency + 'ms' : '--'}</span>
            <span class="stat-label" style="font-size:var(--font-size-xs);color:var(--text-muted)">Avg Latency</span>
          </div>
        </div>

        <!-- Connection History -->
        ${historyHtml}

        <!-- Actions -->
        <div class="provider-card-actions" style="display:flex;align-items:center;gap:var(--space-3);margin-top:var(--space-4);padding-top:var(--space-4);border-top:1px solid var(--border-subtle)">
          <button class="btn btn-sm btn-primary test-connection-btn" data-provider="${escapeHtml(key)}" style="background:${meta.gradient};border:none">
            Test Connection
          </button>
          ${hasHistory ? `<button class="btn btn-sm btn-ghost toggle-history-btn" data-provider="${escapeHtml(key)}" style="font-size:var(--font-size-xs)">History</button>` : ''}
        </div>
      </div>
    `;
  }

  /* ========================================================================
     Routing Config
     ======================================================================== */

  /**
   * Render the routing configuration section.
   * @private
   */
  _renderRoutingConfig(detailsEl, routing) {
    const defaultProvider = routing.default || routing.defaultProvider || 'auto';
    const fallback = routing.fallback || routing.fallbackChain || ['ollama', 'openai', 'anthropic'];
    const strategy = routing.strategy || 'cost-optimized';

    // Build fallback chain visualization
    const chainHtml = fallback
      .map((name, i) => {
        const meta = PROVIDER_META[name.toLowerCase()];
        const color = meta ? meta.color : 'var(--text-muted)';
        const label = meta ? meta.label : name;
        const isLast = i === fallback.length - 1;

        return `
          <div style="display:inline-flex;align-items:center;gap:var(--space-2)">
            <span style="display:inline-flex;align-items:center;gap:var(--space-2);padding:var(--space-2) var(--space-3);border-radius:var(--radius-md);background:${meta ? meta.dim : 'var(--bg-tertiary)'};border:1px solid ${color}30;font-size:var(--font-size-sm);font-weight:var(--font-weight-medium);color:${color}">
              <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></span>
              ${escapeHtml(label)}
            </span>
            ${!isLast ? `<span style="color:var(--text-muted)">${ICONS.arrow}</span>` : ''}
          </div>
        `;
      })
      .join('');

    // Strategy badge color
    const strategyColors = {
      'cost-optimized': { bg: 'var(--accent-green-dim)', color: 'var(--accent-green)' },
      'latency-optimized': { bg: 'var(--accent-blue-dim)', color: 'var(--accent-blue)' },
      'round-robin': { bg: 'var(--accent-purple-dim)', color: 'var(--accent-purple)' },
      'quality-first': { bg: 'var(--accent-orange-dim)', color: 'var(--accent-orange)' },
    };
    const stratColor = strategyColors[strategy] || strategyColors['cost-optimized'];

    detailsEl.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:var(--space-6);margin-bottom:var(--space-6)">
        <div>
          <div style="font-size:var(--font-size-xs);text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);margin-bottom:var(--space-2)">Default Provider</div>
          <div style="font-size:var(--font-size-md);font-weight:var(--font-weight-semibold);color:var(--text-white)">${escapeHtml(defaultProvider)}</div>
        </div>
        <div>
          <div style="font-size:var(--font-size-xs);text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);margin-bottom:var(--space-2)">Strategy</div>
          <span style="display:inline-flex;align-items:center;padding:var(--space-1) var(--space-3);border-radius:var(--radius-full);background:${stratColor.bg};color:${stratColor.color};font-size:var(--font-size-sm);font-weight:var(--font-weight-medium)">${escapeHtml(strategy)}</span>
        </div>
        <div>
          <div style="font-size:var(--font-size-xs);text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);margin-bottom:var(--space-2)">Providers in Chain</div>
          <div style="font-size:var(--font-size-md);font-weight:var(--font-weight-semibold);color:var(--text-white)">${fallback.length}</div>
        </div>
      </div>

      <div>
        <div style="font-size:var(--font-size-xs);text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);margin-bottom:var(--space-3)">Fallback Chain</div>
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-2)">
          ${chainHtml}
        </div>
      </div>
    `;
  }

  /* ========================================================================
     Connection Testing
     ======================================================================== */

  /**
   * Test a provider connection and record history.
   * @private
   */
  async _testConnection(name, btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner spinner--sm" style="width:14px;height:14px;border-width:2px;margin-right:6px"></span>Testing...';

    const startTime = Date.now();

    try {
      const result = await this.api.testProvider(name);
      const success = result.status === 'ok' || result.success || result.connected;
      const elapsed = Date.now() - startTime;

      // Record history
      this._recordHistory(name, {
        timestamp: new Date().toISOString(),
        success,
        latency: elapsed,
        error: success ? null : result.error || 'Connection failed',
      });

      if (success) {
        showToast(`${PROVIDER_META[name]?.label || name} connection successful`, 'success');
        btn.innerHTML = `${ICONS.check} Connected`;
        btn.style.background = 'var(--accent-green)';

        // Update status dot in card header
        const card = btn.closest('.model-provider-card');
        if (card) {
          const dot = card.querySelector('.provider-status-dot');
          const text = dot?.nextElementSibling;
          if (dot) {
            dot.style.background = '#4ade80';
            dot.style.boxShadow = '0 0 8px rgba(74,222,128,0.6)';
            dot.style.animation = 'pulseDot 2s ease-in-out infinite';
            dot.className = 'provider-status-dot provider-status-dot--online';
          }
          if (text) text.textContent = 'Online';
        }
      } else {
        showToast(`${PROVIDER_META[name]?.label || name}: ${result.error || 'Connection failed'}`, 'error');
        btn.innerHTML = `${ICONS.cross} Failed`;
        btn.style.background = 'var(--accent-red)';
      }
    } catch (err) {
      const elapsed = Date.now() - startTime;

      this._recordHistory(name, {
        timestamp: new Date().toISOString(),
        success: false,
        latency: elapsed,
        error: err.message,
      });

      showToast(`${PROVIDER_META[name]?.label || name}: ${err.message}`, 'error');
      btn.innerHTML = `${ICONS.cross} Failed`;
      btn.style.background = 'var(--accent-red)';
    }

    // Reset button after 3 seconds
    const meta = PROVIDER_META[name];
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = 'Test Connection';
      btn.style.background = meta ? meta.gradient : '';
      // Re-render to show updated history
      this._renderProviders();
    }, 3000);
  }

  /**
   * Record a connection test result in history.
   * @private
   */
  _recordHistory(providerKey, entry) {
    if (!connectionHistory[providerKey]) {
      connectionHistory[providerKey] = [];
    }
    connectionHistory[providerKey].unshift(entry);
    if (connectionHistory[providerKey].length > MAX_HISTORY) {
      connectionHistory[providerKey] = connectionHistory[providerKey].slice(0, MAX_HISTORY);
    }
  }

  /**
   * Format a timestamp to a short readable string.
   * @private
   */
  _formatTimestamp(isoString) {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const now = Date.now();
      const diffSec = Math.floor((now - date.getTime()) / 1000);

      if (diffSec < 5) return 'just now';
      if (diffSec < 60) return `${diffSec}s ago`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch {
      return '';
    }
  }

  /* ========================================================================
     Cleanup
     ======================================================================== */

  /**
   * Cleanup subscriptions.
   * @private
   */
  _cleanup() {
    this._unsubs.forEach((fn) => fn());
    this._unsubs = [];
  }
}
