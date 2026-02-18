/**
 * AIOS V2 - Audit Page (V1-Level Polish)
 * Gradient header, event type distribution, date range filters, search,
 * enhanced detail dialog, export button.
 */

import { showToast } from '../components/toast.js';
import { escapeHtml, formatRelative, $ } from '../utils.js';

const ICONS = {
  audit: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l8 4v6c0 5.5-3.8 10.7-8 12-4.2-1.3-8-6.5-8-12V6l8-4z"/><path d="M9 12l2 2 4-4"/></svg>`,
  download: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v8M5 7l3 3 3-3M2 12v1.5a.5.5 0 00.5.5h11a.5.5 0 00.5-.5V12"/></svg>`,
  search: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="7" r="5"/><path d="M11 11l3 3"/></svg>`,
};

const SEVERITY_STYLES = {
  critical: { badge: 'badge-severity-critical', color: '#ef4444' },
  high: { badge: 'badge-severity-high', color: '#f97316' },
  error: { badge: 'badge-severity-critical', color: '#ef4444' },
  warning: { badge: 'badge-severity-medium', color: '#f59e0b' },
  medium: { badge: 'badge-severity-medium', color: '#f59e0b' },
  low: { badge: 'badge-severity-low', color: '#3b82f6' },
  info: { badge: 'badge-severity-info', color: '#6b7280' },
};

export class AuditPage {
  constructor(app) {
    this.state = app.state;
    this.api = app.api;
    this.router = app.router;
    this._unsubs = [];
    this._filter = {};
    this._events = [];
  }

  render(mount) {
    mount.innerHTML = `
      <div class="page page-audit">
        <!-- Gradient Header -->
        <div class="page-gradient-header" style="background: var(--gradient-audit)">
          <div class="page-header-content">
            <h1 class="page-title">
              <span class="page-title-icon">${ICONS.audit}</span>
              Audit Trail
            </h1>
            <p class="page-subtitle">Compliance monitoring, security events, and governance logging</p>
            <div class="page-header-actions">
              <a class="btn btn-sm" id="audit-export-btn" href="/api/analytics/export?format=csv" target="_blank" style="background:rgba(255,255,255,0.2);color:#fff;border:1px solid rgba(255,255,255,0.3);text-decoration:none">
                ${ICONS.download} Export CSV
              </a>
            </div>
          </div>
        </div>

        <!-- Stats -->
        <section class="stat-grid" id="audit-stats"></section>

        <!-- Event Type Distribution -->
        <section class="audit-distribution" id="audit-distribution"></section>

        <!-- Filters -->
        <section class="audit-filters glass-card">
          <div class="filter-row">
            <div class="filter-search-wrapper">
              ${ICONS.search}
              <input type="text" class="input filter-search-input" id="audit-search" placeholder="Search user, agent, action..." />
            </div>
            <select class="select filter-select" id="audit-filter-severity">
              <option value="">All Severities</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
              <option value="critical">Critical</option>
            </select>
            <select class="select filter-select" id="audit-filter-type">
              <option value="">All Types</option>
              <option value="escalation">Escalation</option>
              <option value="governance">Governance</option>
              <option value="agent">Agent</option>
              <option value="system">System</option>
              <option value="auth">Auth</option>
            </select>
            <input type="date" class="input filter-date" id="audit-date-from" title="From date" />
            <input type="date" class="input filter-date" id="audit-date-to" title="To date" />
            <label class="checkbox-wrapper">
              <input type="checkbox" id="audit-filter-review" /> <span style="font-size:var(--font-size-sm);color:var(--text-secondary);margin-left:var(--space-1)">Needs Review</span>
            </label>
            <button class="btn btn-sm btn-primary" id="audit-filter-apply">Apply</button>
          </div>
        </section>

        <!-- Table -->
        <section class="audit-table-container glass-card">
          <table class="data-table" id="audit-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Severity</th>
                <th>Type</th>
                <th>Action</th>
                <th>User</th>
                <th>Agent</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody id="audit-tbody">
              <tr><td colspan="7"><div class="loader-overlay" style="min-height:100px"><div class="spinner"></div></div></td></tr>
            </tbody>
          </table>
        </section>

        <!-- Detail Panel -->
        <section class="audit-detail glass-card" id="audit-detail" style="display: none;">
          <div class="detail-header">
            <h3>Event Details</h3>
            <button class="btn btn-sm btn-ghost" id="audit-detail-close">&times;</button>
          </div>
          <div id="audit-detail-body"></div>
        </section>
      </div>
    `;

    this._bindEvents(mount);
    this._fetchData();

    return () => this._cleanup();
  }

  _bindEvents(mount) {
    $('#audit-filter-apply', mount)?.addEventListener('click', () => {
      this._filter.severity = document.getElementById('audit-filter-severity')?.value || '';
      this._filter.type = document.getElementById('audit-filter-type')?.value || '';
      this._filter.requires_review = document.getElementById('audit-filter-review')?.checked;
      this._filter.search = document.getElementById('audit-search')?.value || '';
      this._filter.dateFrom = document.getElementById('audit-date-from')?.value || '';
      this._filter.dateTo = document.getElementById('audit-date-to')?.value || '';
      this._fetchEvents();
    });

    $('#audit-detail-close', mount)?.addEventListener('click', () => {
      document.getElementById('audit-detail').style.display = 'none';
    });
  }

  async _fetchData() {
    await Promise.all([this._fetchSummary(), this._fetchEvents()]);
  }

  async _fetchSummary() {
    try {
      const summary = await this.api._get('/api/audit/summary');
      this._renderStats(summary);
      this._renderDistribution(summary);
    } catch {}
  }

  async _fetchEvents() {
    try {
      let url = '/api/audit/events?limit=100';
      if (this._filter.severity) url += `&severity=${this._filter.severity}`;
      if (this._filter.type) url += `&type=${this._filter.type}`;
      if (this._filter.requires_review) url += `&requires_review=true`;
      if (this._filter.dateFrom) url += `&since=${this._filter.dateFrom}`;
      if (this._filter.dateTo) url += `&until=${this._filter.dateTo}`;

      let events = await this.api._get(url);
      this._events = events || [];

      // Client-side search filter
      if (this._filter.search) {
        const q = this._filter.search.toLowerCase();
        events = events.filter(e =>
          (e.user_id || '').toLowerCase().includes(q) ||
          (e.agent_name || '').toLowerCase().includes(q) ||
          (e.action || '').toLowerCase().includes(q)
        );
      }
      this._renderTable(events);
    } catch {
      const tbody = document.getElementById('audit-tbody');
      if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No audit events</td></tr>';
    }
  }

  _renderStats(summary) {
    const container = document.getElementById('audit-stats');
    if (!container) return;

    container.innerHTML = `
      <div class="stat-card glass-card stagger-item">
        <div class="stat-label">Total Events</div>
        <div class="stat-value stat-value--purple">${summary.total || 0}</div>
      </div>
      <div class="stat-card glass-card stagger-item">
        <div class="stat-label">Critical</div>
        <div class="stat-value stat-value--red">${summary.bySeverity?.critical || 0}</div>
      </div>
      <div class="stat-card glass-card stagger-item">
        <div class="stat-label">Warnings</div>
        <div class="stat-value stat-value--orange">${summary.bySeverity?.warning || 0}</div>
      </div>
      <div class="stat-card glass-card stagger-item">
        <div class="stat-label">Needs Review</div>
        <div class="stat-value stat-value--blue">${summary.requiresReview || 0}</div>
      </div>
    `;
  }

  _renderDistribution(summary) {
    const container = document.getElementById('audit-distribution');
    if (!container || !summary.byType) return;

    const types = Object.entries(summary.byType || {});
    if (types.length === 0) return;

    const typeColors = {
      escalation: 'var(--accent-red)', governance: 'var(--accent-orange)',
      agent: 'var(--accent-blue)', system: 'var(--accent-green)', auth: 'var(--accent-purple)',
    };

    container.innerHTML = `
      <div class="distribution-row">
        ${types.map(([type, count]) => `
          <span class="distribution-badge" style="--dist-color: ${typeColors[type] || 'var(--text-muted)'}">
            <span class="distribution-dot" style="background:${typeColors[type] || 'var(--text-muted)'}"></span>
            ${escapeHtml(type)} <strong>${count}</strong>
          </span>
        `).join('')}
      </div>
    `;
  }

  _renderTable(events) {
    const tbody = document.getElementById('audit-tbody');
    if (!tbody) return;

    if (!events || events.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><p class="empty-state-title">No events match filters</p></div></td></tr>';
      return;
    }

    tbody.innerHTML = events.map(event => {
      const sev = SEVERITY_STYLES[event.severity] || SEVERITY_STYLES.info;
      return `
        <tr class="audit-row" data-id="${escapeHtml(event.id)}" style="cursor:pointer">
          <td style="white-space:nowrap">${formatRelative(event.timestamp)}</td>
          <td><span class="badge ${sev.badge}">${escapeHtml(event.severity)}</span></td>
          <td>${escapeHtml(event.event_type || '')}</td>
          <td>${escapeHtml((event.action || '').slice(0, 60))}</td>
          <td class="mono">${escapeHtml(event.user_id || '-')}</td>
          <td>${escapeHtml(event.agent_name || '-')}</td>
          <td>
            ${event.requires_review && !event.reviewed_by
              ? `<button class="btn btn-sm btn-ghost mark-reviewed-btn" data-id="${escapeHtml(event.id)}">Review</button>`
              : event.reviewed_by ? `<span class="badge badge-online">Done</span>` : '<span style="color:var(--text-muted)">-</span>'
            }
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.audit-row').forEach(row => {
      row.addEventListener('click', () => this._showDetail(row.dataset.id));
    });

    tbody.querySelectorAll('.mark-reviewed-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await this.api._post(`/api/audit/events/${btn.dataset.id}/review`, { reviewer_id: 'admin' });
          showToast('Marked as reviewed', 'success');
          this._fetchData();
        } catch (err) { showToast(`Failed: ${err.message}`, 'error'); }
      });
    });
  }

  _showDetail(id) {
    const event = this._events.find(e => e.id === id);
    if (!event) return;

    const panel = document.getElementById('audit-detail');
    const body = document.getElementById('audit-detail-body');
    if (!panel || !body) return;

    const sev = SEVERITY_STYLES[event.severity] || SEVERITY_STYLES.info;

    panel.style.display = 'block';
    body.innerHTML = `
      ${event.requires_review && !event.reviewed_by ? '<div class="badge badge-severity-critical" style="margin-bottom:var(--space-4)">Requires Review</div>' : ''}
      <div class="detail-meta-grid">
        <div class="detail-meta-item">
          <span class="detail-meta-label">Event ID</span>
          <span class="detail-meta-value mono">${escapeHtml(event.id)}</span>
        </div>
        <div class="detail-meta-item">
          <span class="detail-meta-label">Timestamp</span>
          <span class="detail-meta-value">${escapeHtml(event.timestamp)}</span>
        </div>
        <div class="detail-meta-item">
          <span class="detail-meta-label">Type</span>
          <span class="detail-meta-value">${escapeHtml(event.event_type)}</span>
        </div>
        <div class="detail-meta-item">
          <span class="detail-meta-label">Severity</span>
          <span class="badge ${sev.badge}">${escapeHtml(event.severity)}</span>
        </div>
        <div class="detail-meta-item">
          <span class="detail-meta-label">Action</span>
          <span class="detail-meta-value">${escapeHtml(event.action)}</span>
        </div>
        <div class="detail-meta-item">
          <span class="detail-meta-label">User</span>
          <span class="detail-meta-value mono">${escapeHtml(event.user_id || 'N/A')}</span>
        </div>
        <div class="detail-meta-item">
          <span class="detail-meta-label">Agent</span>
          <span class="detail-meta-value">${escapeHtml(event.agent_name || 'N/A')}</span>
        </div>
        <div class="detail-meta-item">
          <span class="detail-meta-label">Session</span>
          <span class="detail-meta-value mono">${escapeHtml(event.session_id || 'N/A')}</span>
        </div>
      </div>
      ${(event.pii_detected || []).length ? `<div style="margin-top:var(--space-4)"><strong>PII Detected:</strong> ${event.pii_detected.map(p => `<span class="badge badge-severity-critical">${escapeHtml(p)}</span>`).join(' ')}</div>` : ''}
      ${(event.guardrails_triggered || []).length ? `<div style="margin-top:var(--space-4)"><strong>Guardrails:</strong> ${event.guardrails_triggered.map(g => `<span class="badge badge-warning">${escapeHtml(g)}</span>`).join(' ')}</div>` : ''}
      <div style="margin-top:var(--space-4)">
        <strong>Full Details:</strong>
        <pre class="code-block">${escapeHtml(JSON.stringify(event.details || event, null, 2))}</pre>
      </div>
    `;
    panel.scrollIntoView({ behavior: 'smooth' });
  }

  _cleanup() {
    this._unsubs.forEach(fn => fn());
    this._unsubs = [];
  }
}
