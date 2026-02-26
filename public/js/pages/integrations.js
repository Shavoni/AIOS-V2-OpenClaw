/**
 * AIOS V2 - Integrations Page
 * Connector registry with CRUD, approval workflow, status filters, and health indicators.
 */

import { showToast } from '../components/toast.js';
import { escapeHtml, $ } from '../utils.js';

/* ── Status color map ─────────────────────────────────────────────────── */

const STATUS_COLORS = {
  pending:   { color: 'var(--accent-orange)', dim: 'var(--accent-orange-dim)', label: 'Pending' },
  approved:  { color: 'var(--accent-green)',  dim: 'var(--accent-green-dim)',  label: 'Approved' },
  active:    { color: 'var(--accent-green)',  dim: 'var(--accent-green-dim)',  label: 'Active' },
  suspended: { color: 'var(--accent-red)',    dim: 'var(--accent-red-dim)',    label: 'Suspended' },
};

const TYPE_ICONS = {
  webhook: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 2a8 8 0 100 16 8 8 0 000-16z"/><path d="M6 10h8M10 6v8"/></svg>`,
  api:     `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 5h14M3 10h14M3 15h14"/><circle cx="7" cy="5" r="1.5" fill="currentColor"/><circle cx="13" cy="10" r="1.5" fill="currentColor"/><circle cx="9" cy="15" r="1.5" fill="currentColor"/></svg>`,
  default: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M7 10l2 2 4-4"/></svg>`,
};

const ICONS = {
  integrations: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>`,
  search: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="7" r="5"/><path d="M11 11l3.5 3.5"/></svg>`,
  plus:   `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 2v10M2 7h10"/></svg>`,
  close:  `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4l8 8M12 4l-8 8"/></svg>`,
};

/* ══════════════════════════════════════════════════════════════════════════
   Integrations Page Class
   ══════════════════════════════════════════════════════════════════════════ */

export class IntegrationsPage {
  constructor(app) {
    this.state = app.state;
    this.api = app.api;
    this.router = app.router;
    this._unsubs = [];
    this._connectors = [];
    this._searchQuery = '';
    this._activeFilter = 'all';
    this._showAddForm = false;
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  render(mount) {
    mount.innerHTML = `
      <div class="page page-integrations">

        <!-- Gradient Header -->
        <div class="page-gradient-header" style="background: linear-gradient(135deg, #7b2ff7 0%, #00b4d8 50%, #00ff88 100%)">
          <div class="page-header-content">
            <h1 class="page-title">
              <span class="page-title-icon">${ICONS.integrations}</span>
              Integrations
            </h1>
            <p class="page-subtitle">Manage third-party connectors, webhooks, and API integrations</p>
            <div class="page-header-actions">
              <button class="btn btn-sm" id="add-connector-btn"
                      style="background:rgba(255,255,255,0.2);color:#fff;border:1px solid rgba(255,255,255,0.3)">
                ${ICONS.plus} Add Connector
              </button>
              <span class="badge" id="integrations-count-badge"
                    style="background:rgba(255,255,255,0.2);color:#fff;font-size:var(--font-size-sm);padding:0.3rem 0.8rem">
                0 connectors
              </span>
            </div>
          </div>
        </div>

        <!-- Stats Row -->
        <section class="stat-grid" id="integrations-stats" style="margin-bottom:var(--space-8)"></section>

        <!-- Add Connector Form (hidden) -->
        <div class="add-connector-form glass-card" id="add-connector-form" style="display:none;margin-bottom:var(--space-6);padding:var(--space-5)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-4)">
            <h3 style="color:var(--text-white);margin:0">New Connector</h3>
            <button class="btn btn-sm btn-ghost" id="close-add-form">${ICONS.close}</button>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4)">
            <div>
              <label class="input-label">Name</label>
              <input type="text" class="input" id="connector-name" placeholder="My Webhook" />
            </div>
            <div>
              <label class="input-label">Type</label>
              <select class="input" id="connector-type">
                <option value="webhook">Webhook</option>
                <option value="api">API</option>
              </select>
            </div>
            <div style="grid-column:1/-1">
              <label class="input-label">Description</label>
              <input type="text" class="input" id="connector-description" placeholder="What does this connector do?" />
            </div>
          </div>
          <button class="btn btn-primary btn-sm" id="submit-connector" style="margin-top:var(--space-4)">
            ${ICONS.plus} Create Connector
          </button>
        </div>

        <!-- Search / Filter Toolbar -->
        <div class="integrations-toolbar" id="integrations-toolbar">
          <div class="integrations-search" style="position:relative">
            <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-muted);pointer-events:none">${ICONS.search}</span>
            <input type="text" class="input" id="integrations-search-input"
                   placeholder="Search connectors..."
                   style="padding-left:36px" />
          </div>
          <div class="integrations-filter-chips" id="integrations-filter-chips"></div>
        </div>

        <!-- Connector Grid -->
        <div class="integrations-grid" id="integrations-grid">
          <div class="loader-overlay" style="min-height:200px">
            <div class="spinner"></div>
            <span style="color:var(--text-secondary)">Loading connectors...</span>
          </div>
        </div>

      </div>
    `;

    this._bindEvents(mount);
    this._fetchConnectors();
    return () => this._cleanup();
  }

  /* ── Bind Events ─────────────────────────────────────────────────────── */

  _bindEvents(mount) {
    const searchInput = $('#integrations-search-input', mount);
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this._searchQuery = e.target.value.trim().toLowerCase();
        this._renderGrid();
      });
    }

    const addBtn = $('#add-connector-btn', mount);
    if (addBtn) {
      addBtn.addEventListener('click', () => this._toggleAddForm(true));
    }

    const closeBtn = $('#close-add-form', mount);
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this._toggleAddForm(false));
    }

    const submitBtn = $('#submit-connector', mount);
    if (submitBtn) {
      submitBtn.addEventListener('click', () => this._createConnector());
    }
  }

  /* ── Fetch Connectors ────────────────────────────────────────────────── */

  async _fetchConnectors() {
    try {
      this._connectors = await this.api._get('/api/integrations');
      this._onDataUpdated();
    } catch (err) {
      const grid = document.getElementById('integrations-grid');
      if (grid) {
        grid.innerHTML = `
          <div class="empty-state" style="grid-column:1/-1">
            <div class="empty-state-icon">${ICONS.integrations}</div>
            <p class="empty-state-title">Failed to load connectors</p>
            <p class="empty-state-desc">${escapeHtml(err.message)}</p>
            <button class="btn btn-sm btn-primary" id="integrations-retry" style="margin-top:var(--space-4)">Retry</button>
          </div>
        `;
        const retryBtn = $('#integrations-retry');
        if (retryBtn) retryBtn.addEventListener('click', () => this._fetchConnectors());
      }
    }
  }

  /* ── On data updated ──────────────────────────────────────────────────── */

  _onDataUpdated() {
    this._renderCountBadge();
    this._renderStats();
    this._renderFilterChips();
    this._renderGrid();
  }

  /* ── Count Badge ─────────────────────────────────────────────────────── */

  _renderCountBadge() {
    const badge = document.getElementById('integrations-count-badge');
    if (badge) {
      badge.textContent = `${this._connectors.length} connector${this._connectors.length !== 1 ? 's' : ''}`;
    }
  }

  /* ── Stats Row ───────────────────────────────────────────────────────── */

  _renderStats() {
    const container = document.getElementById('integrations-stats');
    if (!container) return;

    const total = this._connectors.length;
    const approved = this._connectors.filter(c => c.status === 'approved' || c.status === 'active').length;
    const pending = this._connectors.filter(c => c.status === 'pending').length;
    const suspended = this._connectors.filter(c => c.status === 'suspended').length;

    container.innerHTML = `
      <div class="stat-card glass-card stagger-item">
        <div class="stat-label">Total Connectors</div>
        <div class="stat-value stat-value--blue">${total}</div>
      </div>
      <div class="stat-card glass-card stagger-item">
        <div class="stat-label">Approved</div>
        <div class="stat-value stat-value--green">${approved}</div>
      </div>
      <div class="stat-card glass-card stagger-item">
        <div class="stat-label">Pending</div>
        <div class="stat-value stat-value--orange">${pending}</div>
      </div>
      <div class="stat-card glass-card stagger-item">
        <div class="stat-label">Suspended</div>
        <div class="stat-value stat-value--red">${suspended}</div>
      </div>
    `;
  }

  /* ── Filter Chips ────────────────────────────────────────────────────── */

  _renderFilterChips() {
    const container = document.getElementById('integrations-filter-chips');
    if (!container) return;

    const statuses = ['all', 'pending', 'approved', 'active', 'suspended'];
    let html = '';
    statuses.forEach(status => {
      const label = status.charAt(0).toUpperCase() + status.slice(1);
      const count = status === 'all'
        ? this._connectors.length
        : this._connectors.filter(c => c.status === status).length;
      html += `<button class="integrations-filter-chip ${this._activeFilter === status ? 'active' : ''}"
                       data-status="${status}">${escapeHtml(label)} <span class="chip-count">(${count})</span></button>`;
    });
    container.innerHTML = html;

    container.querySelectorAll('.integrations-filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this._activeFilter = chip.dataset.status;
        container.querySelectorAll('.integrations-filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this._renderGrid();
      });
    });
  }

  /* ── Filtered connectors ──────────────────────────────────────────────── */

  _getFiltered() {
    let filtered = [...this._connectors];

    if (this._activeFilter !== 'all') {
      filtered = filtered.filter(c => c.status === this._activeFilter);
    }

    if (this._searchQuery) {
      filtered = filtered.filter(c => {
        const name = (c.name || '').toLowerCase();
        const desc = (c.description || '').toLowerCase();
        return name.includes(this._searchQuery) || desc.includes(this._searchQuery);
      });
    }

    return filtered;
  }

  /* ── Render Grid ─────────────────────────────────────────────────────── */

  _renderGrid() {
    const grid = document.getElementById('integrations-grid');
    if (!grid) return;

    const connectors = this._getFiltered();

    if (!connectors || connectors.length === 0) {
      const isFiltered = this._searchQuery || this._activeFilter !== 'all';
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-state-icon">${ICONS.integrations}</div>
          <p class="empty-state-title">${isFiltered ? 'No matching connectors' : 'No connectors yet'}</p>
          <p class="empty-state-desc">${isFiltered ? 'Try adjusting your filters.' : 'Click "Add Connector" to get started.'}</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = '';

    connectors.forEach(connector => {
      const statusStyle = STATUS_COLORS[connector.status] || STATUS_COLORS.pending;
      const typeIcon = TYPE_ICONS[connector.type] || TYPE_ICONS.default;
      const healthDot = connector.health_status === 'healthy' ? 'pulse-dot' : 'pulse-dot pulse-dot--red';

      const card = document.createElement('div');
      card.className = 'connector-card glass-card card-accent-top stagger-item';
      card.dataset.connectorId = connector.id;
      card.style.setProperty('--card-accent', statusStyle.color);

      card.innerHTML = `
        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${statusStyle.color}"></div>
        <div class="connector-card-header">
          <div class="connector-card-icon" style="width:44px;height:44px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;background:${statusStyle.dim};color:${statusStyle.color}">
            ${typeIcon}
          </div>
          <div class="connector-card-info">
            <h3 class="connector-card-name">${escapeHtml(connector.name)}</h3>
            <div style="display:flex;gap:var(--space-2);align-items:center">
              <span class="badge" style="background:${statusStyle.dim};color:${statusStyle.color};font-size:var(--font-size-xs);padding:0.1rem 0.4rem">${escapeHtml(statusStyle.label)}</span>
              <span class="badge" style="font-size:var(--font-size-xs);padding:0.1rem 0.4rem">${escapeHtml(connector.type)}</span>
            </div>
          </div>
        </div>
        <p class="connector-card-desc">${escapeHtml(connector.description || 'No description')}</p>
        <div class="connector-card-footer">
          <span class="connector-health">
            <span class="${healthDot}" style="width:6px;height:6px"></span>
            ${escapeHtml(connector.health_status || 'unknown')}
          </span>
          <div class="connector-card-actions">
            ${connector.status === 'pending'
              ? `<button class="btn btn-xs btn-primary connector-approve" data-id="${connector.id}">Approve</button>`
              : ''}
            ${connector.status === 'approved' || connector.status === 'active'
              ? `<button class="btn btn-xs btn-ghost connector-suspend" data-id="${connector.id}">Suspend</button>`
              : ''}
          </div>
        </div>
      `;

      grid.appendChild(card);
    });

    // Bind approve/suspend buttons
    grid.querySelectorAll('.connector-approve').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._approveConnector(btn.dataset.id);
      });
    });
    grid.querySelectorAll('.connector-suspend').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._suspendConnector(btn.dataset.id);
      });
    });
  }

  /* ── Toggle Add Form ──────────────────────────────────────────────────── */

  _toggleAddForm(show) {
    const form = document.getElementById('add-connector-form');
    if (form) form.style.display = show ? '' : 'none';
    this._showAddForm = show;
  }

  /* ── Create Connector ─────────────────────────────────────────────────── */

  async _createConnector() {
    const name = document.getElementById('connector-name')?.value.trim();
    const type = document.getElementById('connector-type')?.value;
    const description = document.getElementById('connector-description')?.value.trim();

    if (!name) {
      showToast('Connector name is required', 'error');
      return;
    }

    try {
      await this.api._post('/api/integrations', { name, type, description });
      showToast('Connector created', 'success');
      this._toggleAddForm(false);
      await this._fetchConnectors();
    } catch (err) {
      showToast(`Failed to create connector: ${err.message}`, 'error');
    }
  }

  /* ── Approve Connector ────────────────────────────────────────────────── */

  async _approveConnector(id) {
    try {
      await this.api._post(`/api/integrations/${id}/approve`);
      showToast('Connector approved', 'success');
      await this._fetchConnectors();
    } catch (err) {
      showToast(`Failed to approve: ${err.message}`, 'error');
    }
  }

  /* ── Suspend Connector ────────────────────────────────────────────────── */

  async _suspendConnector(id) {
    try {
      await this.api._post(`/api/integrations/${id}/suspend`);
      showToast('Connector suspended', 'success');
      await this._fetchConnectors();
    } catch (err) {
      showToast(`Failed to suspend: ${err.message}`, 'error');
    }
  }

  /* ── Cleanup ─────────────────────────────────────────────────────────── */

  _cleanup() {
    this._unsubs.forEach(fn => fn());
    this._unsubs = [];
    this._connectors = [];
  }
}
