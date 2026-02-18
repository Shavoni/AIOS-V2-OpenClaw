/**
 * AIOS V2 - Approvals Page (V1-Level Polish)
 * Dual-tab system, gradient header, SLA indicators, batch actions,
 * priority badges, advanced filters.
 */

import { showToast } from '../components/toast.js';
import { showModal, hideModal } from '../components/modal.js';
import { createTabs } from '../components/tabs.js';
import { escapeHtml, formatRelative, $ } from '../utils.js';

const SLA_LIMITS = { urgent: 1, high: 4, normal: 24, low: 72 };

const ICONS = {
  approvals: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg>`,
  check: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7l3 3 5-5"/></svg>`,
  x: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3l8 8M11 3l-8 8"/></svg>`,
  eye: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z"/><circle cx="7" cy="7" r="2"/></svg>`,
  clock: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="6" cy="6" r="5"/><path d="M6 3v3l2 1"/></svg>`,
  search: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="7" r="5"/><path d="M11 11l3 3"/></svg>`,
};

export class ApprovalsPage {
  constructor(app) {
    this.state = app.state;
    this.api = app.api;
    this.router = app.router;
    this._unsubs = [];
    this._filter = { status: 'pending' };
    this._selectedIds = new Set();
    this._activeTab = 'responses';
    this._approvals = [];
  }

  render(mount) {
    mount.innerHTML = `
      <div class="page page-approvals">
        <!-- Gradient Header -->
        <div class="page-gradient-header" style="background: var(--gradient-approvals)">
          <div class="page-header-content">
            <h1 class="page-title">
              <span class="page-title-icon">${ICONS.approvals}</span>
              Approvals
            </h1>
            <p class="page-subtitle">Human-in-the-loop review queue and pending agent approvals</p>
          </div>
        </div>

        <!-- Stats -->
        <section class="stat-grid" id="approval-stats"></section>

        <!-- Tabs -->
        <section id="approval-tabs-container"></section>

        <!-- Filters -->
        <section class="approval-filters glass-card">
          <div class="filter-row">
            <div class="filter-search-wrapper">
              ${ICONS.search}
              <input type="text" class="input filter-search-input" id="filter-search" placeholder="Search queries, agents..." />
            </div>
            <select class="select filter-select" id="filter-status">
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="">All</option>
            </select>
            <select class="select filter-select" id="filter-priority">
              <option value="">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
            <select class="select filter-select" id="filter-mode">
              <option value="">All Modes</option>
              <option value="DRAFT">Draft</option>
              <option value="ESCALATE">Escalation</option>
            </select>
            <button class="btn btn-sm btn-primary" id="filter-apply">Apply</button>
          </div>
        </section>

        <!-- Batch Toolbar (hidden initially) -->
        <section class="batch-toolbar" id="batch-toolbar" style="display:none">
          <span class="batch-count" id="batch-count">0 selected</span>
          <button class="btn btn-sm btn-primary" id="batch-approve">${ICONS.check} Approve All</button>
          <button class="btn btn-sm btn-danger" id="batch-reject">${ICONS.x} Reject All</button>
          <button class="btn btn-sm btn-ghost" id="batch-clear">Clear</button>
        </section>

        <!-- Response Approvals Tab -->
        <section id="tab-responses">
          <div class="approval-list" id="approval-list">
            <div class="loader-overlay" style="min-height:200px"><div class="spinner"></div></div>
          </div>
        </section>

        <!-- Pending Agents Tab -->
        <section id="tab-agents" style="display:none">
          <div id="pending-agents-list">
            <div class="loader-overlay" style="min-height:200px"><div class="spinner"></div></div>
          </div>
        </section>

        <!-- Review Panel -->
        <section class="approval-review glass-card" id="approval-review" style="display: none;">
          <div class="review-header">
            <h2>Review Request</h2>
            <button class="btn btn-sm btn-ghost" id="review-close">&times;</button>
          </div>
          <div id="review-body"></div>
        </section>
      </div>
    `;

    this._setupTabs();
    this._bindEvents(mount);
    this._fetchData();

    return () => this._cleanup();
  }

  _setupTabs() {
    const tabsComp = createTabs({
      tabs: [
        { id: 'responses', label: 'Response Approvals' },
        { id: 'agents', label: 'Pending Agents' },
      ],
      activeTab: 'responses',
      onTabChange: (id) => {
        this._activeTab = id;
        document.getElementById('tab-responses').style.display = id === 'responses' ? '' : 'none';
        document.getElementById('tab-agents').style.display = id === 'agents' ? '' : 'none';
        if (id === 'agents') this._fetchPendingAgents();
      }
    });
    const container = document.getElementById('approval-tabs-container');
    if (container) container.appendChild(tabsComp.el);
  }

  _bindEvents(mount) {
    $('#filter-apply', mount)?.addEventListener('click', () => {
      this._filter.status = document.getElementById('filter-status')?.value || '';
      this._filter.mode = document.getElementById('filter-mode')?.value || '';
      this._filter.priority = document.getElementById('filter-priority')?.value || '';
      this._filter.search = document.getElementById('filter-search')?.value || '';
      this._fetchQueue();
    });

    $('#review-close', mount)?.addEventListener('click', () => {
      document.getElementById('approval-review').style.display = 'none';
    });

    // Batch actions
    $('#batch-approve', mount)?.addEventListener('click', () => this._batchAction('approve'));
    $('#batch-reject', mount)?.addEventListener('click', () => this._batchAction('reject'));
    $('#batch-clear', mount)?.addEventListener('click', () => {
      this._selectedIds.clear();
      this._updateBatchToolbar();
      document.querySelectorAll('.approval-checkbox').forEach(cb => cb.checked = false);
    });
  }

  async _fetchData() {
    await Promise.all([this._fetchSummary(), this._fetchQueue()]);
  }

  async _fetchSummary() {
    try {
      const summary = await this.api._get('/api/hitl/queue/summary');
      this._renderStats(summary);
    } catch {}
  }

  async _fetchQueue() {
    try {
      let url = '/api/hitl/approvals?limit=50';
      if (this._filter.status) url += `&status=${this._filter.status}`;
      if (this._filter.mode) url += `&mode=${this._filter.mode}`;
      const approvals = await this.api._get(url);
      this._approvals = approvals || [];

      // Client-side filtering for search and priority
      let filtered = this._approvals;
      if (this._filter.search) {
        const q = this._filter.search.toLowerCase();
        filtered = filtered.filter(a =>
          (a.original_query || '').toLowerCase().includes(q) ||
          (a.agent_name || '').toLowerCase().includes(q)
        );
      }
      if (this._filter.priority) {
        filtered = filtered.filter(a => (a.priority || 'normal') === this._filter.priority);
      }
      this._renderList(filtered);
    } catch {
      const list = document.getElementById('approval-list');
      if (list) list.innerHTML = `<div class="empty-state"><p class="empty-state-title">No approvals in queue</p></div>`;
    }
  }

  async _fetchPendingAgents() {
    const container = document.getElementById('pending-agents-list');
    if (!container) return;
    try {
      const agents = await this.api._get('/api/system/pending-agents');
      if (!agents || agents.length === 0) {
        container.innerHTML = `<div class="empty-state"><p class="empty-state-title">No pending agents</p><p class="empty-state-desc">All agents have been reviewed.</p></div>`;
        return;
      }
      container.innerHTML = agents.map(a => `
        <div class="approval-item glass-card stagger-item">
          <div class="approval-item-header">
            <span class="badge badge-domain-${(a.domain || 'general').toLowerCase()}">${escapeHtml(a.domain || 'General')}</span>
            <span class="badge badge-warning">Pending Review</span>
          </div>
          <h3 style="margin:var(--space-2) 0;color:var(--text-white)">${escapeHtml(a.name)}</h3>
          <p style="font-size:var(--font-size-sm);color:var(--text-secondary)">${escapeHtml(a.description || 'No description')}</p>
          <div class="approval-actions">
            <button class="btn btn-sm btn-primary pending-approve" data-id="${a.id}">Approve</button>
            <button class="btn btn-sm btn-danger pending-reject" data-id="${a.id}">Reject</button>
          </div>
        </div>
      `).join('');

      container.querySelectorAll('.pending-approve').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await this.api._post(`/api/system/pending-agents/${btn.dataset.id}/approve`, {});
            showToast('Agent approved', 'success');
            this._fetchPendingAgents();
          } catch (err) { showToast(`Failed: ${err.message}`, 'error'); }
        });
      });
      container.querySelectorAll('.pending-reject').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await this.api._post(`/api/system/pending-agents/${btn.dataset.id}/reject`, {});
            showToast('Agent rejected', 'success');
            this._fetchPendingAgents();
          } catch (err) { showToast(`Failed: ${err.message}`, 'error'); }
        });
      });
    } catch {
      container.innerHTML = `<div class="empty-state"><p class="empty-state-desc">Could not load pending agents.</p></div>`;
    }
  }

  _renderStats(summary) {
    const container = document.getElementById('approval-stats');
    if (!container) return;

    container.innerHTML = `
      <div class="stat-card glass-card stagger-item">
        <div class="stat-label">Pending</div>
        <div class="stat-value stat-value--orange">${summary.pending || 0}</div>
      </div>
      <div class="stat-card glass-card stagger-item">
        <div class="stat-label">Urgent</div>
        <div class="stat-value stat-value--red">${summary.byPriority?.urgent || 0}</div>
      </div>
      <div class="stat-card glass-card stagger-item">
        <div class="stat-label">Escalated</div>
        <div class="stat-value stat-value--purple">${summary.byMode?.ESCALATE || 0}</div>
      </div>
      <div class="stat-card glass-card stagger-item">
        <div class="stat-label">Avg Resolution</div>
        <div class="stat-value stat-value--blue">${summary.avgResolutionTime ? `${summary.avgResolutionTime}m` : '--'}</div>
      </div>
    `;
  }

  _renderList(approvals) {
    const container = document.getElementById('approval-list');
    if (!container) return;

    if (!approvals || approvals.length === 0) {
      container.innerHTML = '<div class="empty-state"><p class="empty-state-title">No items match filters</p></div>';
      return;
    }

    container.innerHTML = approvals.map(item => {
      const priority = item.priority || 'normal';
      const slaInfo = this._calcSLA(item);
      const hitlMode = (item.hitl_mode || 'DRAFT').toUpperCase();

      return `
        <div class="approval-item glass-card stagger-item" data-id="${escapeHtml(item.id)}">
          <div class="approval-item-header">
            ${item.status === 'pending' ? `<label class="checkbox-wrapper"><input type="checkbox" class="approval-checkbox" data-id="${escapeHtml(item.id)}" /></label>` : ''}
            <span class="badge badge-hitl-${hitlMode.toLowerCase()}">${hitlMode === 'ESCALATE' ? 'Escalation' : 'Draft Review'}</span>
            <span class="badge badge-priority-${priority}">${priority}</span>
            ${item.risk_signals?.length ? '<span class="badge badge-severity-critical">Risk Signal</span>' : ''}
            <div class="approval-sla-time">
              ${slaInfo.html}
            </div>
            <span class="approval-time">${formatRelative(item.created_at)}</span>
          </div>
          <div class="approval-query">
            <strong>Query:</strong> ${escapeHtml((item.original_query || '').slice(0, 200))}
          </div>
          ${item.escalation_reason ? `<div class="approval-reason"><span class="badge badge-severity-high">Escalation:</span> ${escapeHtml(item.escalation_reason)}</div>` : ''}
          ${item.agent_name ? `<div class="approval-agent">Agent: <strong>${escapeHtml(item.agent_name)}</strong></div>` : ''}
          ${item.status === 'pending' ? `
          <div class="approval-actions">
            <button class="btn btn-sm btn-primary approve-btn" data-id="${escapeHtml(item.id)}">${ICONS.check} Approve</button>
            <button class="btn btn-sm btn-ghost reject-btn" data-id="${escapeHtml(item.id)}">${ICONS.x} Reject</button>
            <button class="btn btn-sm btn-ghost review-btn" data-id="${escapeHtml(item.id)}">${ICONS.eye} Review</button>
          </div>` : `<div class="approval-status-result"><span class="badge ${item.status === 'approved' ? 'badge-online' : 'badge-offline'}">${item.status}</span>${item.reviewer_notes ? ` <em style="color:var(--text-muted)">${escapeHtml(item.reviewer_notes)}</em>` : ''}</div>`}
        </div>
      `;
    }).join('');

    // Bind actions
    container.querySelectorAll('.approve-btn').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); this._approve(btn.dataset.id); });
    });
    container.querySelectorAll('.reject-btn').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); this._reject(btn.dataset.id); });
    });
    container.querySelectorAll('.review-btn').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); this._showReview(btn.dataset.id); });
    });
    container.querySelectorAll('.approval-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) this._selectedIds.add(cb.dataset.id);
        else this._selectedIds.delete(cb.dataset.id);
        this._updateBatchToolbar();
      });
    });
  }

  _calcSLA(item) {
    if (item.status !== 'pending') return { html: '' };
    const priority = item.priority || 'normal';
    const limitHours = SLA_LIMITS[priority] || 24;
    const created = new Date(item.created_at).getTime();
    const elapsed = (Date.now() - created) / (1000 * 60 * 60);
    const remaining = limitHours - elapsed;

    if (remaining > limitHours * 0.5) {
      return { html: `<span class="sla-indicator sla-indicator--ok">${ICONS.clock} ${Math.round(remaining)}h left</span>` };
    } else if (remaining > 0) {
      return { html: `<span class="sla-indicator sla-indicator--warning">${ICONS.clock} ${Math.round(remaining)}h left</span>` };
    }
    return { html: `<span class="sla-indicator sla-indicator--breach">${ICONS.clock} SLA Breached</span>` };
  }

  _updateBatchToolbar() {
    const toolbar = document.getElementById('batch-toolbar');
    const count = document.getElementById('batch-count');
    if (!toolbar || !count) return;

    if (this._selectedIds.size > 0) {
      toolbar.style.display = '';
      count.textContent = `${this._selectedIds.size} selected`;
    } else {
      toolbar.style.display = 'none';
    }
  }

  async _batchAction(action) {
    const ids = Array.from(this._selectedIds);
    if (ids.length === 0) return;

    if (!confirm(`${action === 'approve' ? 'Approve' : 'Reject'} ${ids.length} items?`)) return;

    try {
      for (const id of ids) {
        await this.api._post(`/api/hitl/approvals/${id}/${action}`, { reviewer_id: 'admin' });
      }
      showToast(`${ids.length} items ${action}d`, 'success');
      this._selectedIds.clear();
      this._updateBatchToolbar();
      this._fetchData();
    } catch (err) {
      showToast(`Batch ${action} failed: ${err.message}`, 'error');
    }
  }

  async _approve(id) {
    try {
      await this.api._post(`/api/hitl/approvals/${id}/approve`, { reviewer_id: 'admin' });
      showToast('Request approved', 'success');
      this._fetchData();
    } catch (err) { showToast(`Approve failed: ${err.message}`, 'error'); }
  }

  async _reject(id) {
    const reason = prompt('Rejection reason (optional):');
    try {
      await this.api._post(`/api/hitl/approvals/${id}/reject`, { reviewer_id: 'admin', reason: reason || '' });
      showToast('Request rejected', 'success');
      this._fetchData();
    } catch (err) { showToast(`Reject failed: ${err.message}`, 'error'); }
  }

  async _showReview(id) {
    try {
      const item = await this.api._get(`/api/hitl/approvals/${id}`);
      const panel = document.getElementById('approval-review');
      const body = document.getElementById('review-body');
      if (!panel || !body) return;

      panel.style.display = 'block';
      body.innerHTML = `
        ${item.requires_review ? '<div class="badge badge-severity-critical" style="margin-bottom:var(--space-4)">Requires Review</div>' : ''}
        <div class="review-section">
          <h3>Original Query</h3>
          <pre class="code-block">${escapeHtml(item.original_query || '')}</pre>
        </div>
        <div class="review-section">
          <h3>Proposed Response</h3>
          <pre class="code-block">${escapeHtml(item.proposed_response || '')}</pre>
        </div>
        <div class="review-meta-grid">
          <div><strong>Agent:</strong> ${escapeHtml(item.agent_name || 'N/A')}</div>
          <div><strong>Mode:</strong> <span class="badge badge-hitl-${(item.hitl_mode || 'draft').toLowerCase()}">${item.hitl_mode || 'DRAFT'}</span></div>
          <div><strong>Priority:</strong> <span class="badge badge-priority-${item.priority || 'normal'}">${item.priority || 'normal'}</span></div>
          <div><strong>Confidence:</strong> ${item.confidence ? `${(item.confidence * 100).toFixed(0)}%` : 'N/A'}</div>
        </div>
        ${(item.risk_signals || []).length ? `<div class="review-section"><h3>Risk Signals</h3><div class="review-badges">${item.risk_signals.map(s => `<span class="badge badge-severity-critical">${escapeHtml(s)}</span>`).join(' ')}</div></div>` : ''}
        ${(item.guardrails_triggered || []).length ? `<div class="review-section"><h3>Guardrails Triggered</h3><div class="review-badges">${item.guardrails_triggered.map(g => `<span class="badge badge-warning">${escapeHtml(g)}</span>`).join(' ')}</div></div>` : ''}
        <div class="review-section">
          <label class="input-label">Modified Response (optional):</label>
          <textarea class="textarea" id="review-modified" rows="4">${escapeHtml(item.proposed_response || '')}</textarea>
        </div>
        <div class="review-section">
          <label class="input-label">Reviewer Notes:</label>
          <input type="text" class="input" id="review-notes" placeholder="Add notes..." />
        </div>
        <div class="review-actions">
          <button class="btn btn-primary" id="review-approve-btn">${ICONS.check} Approve</button>
          <button class="btn btn-danger" id="review-reject-btn">${ICONS.x} Reject</button>
        </div>
      `;

      document.getElementById('review-approve-btn')?.addEventListener('click', async () => {
        const modified = document.getElementById('review-modified')?.value;
        const notes = document.getElementById('review-notes')?.value;
        await this.api._post(`/api/hitl/approvals/${id}/approve`, { reviewer_id: 'admin', notes, modified_response: modified });
        showToast('Approved', 'success');
        panel.style.display = 'none';
        this._fetchData();
      });

      document.getElementById('review-reject-btn')?.addEventListener('click', async () => {
        const notes = document.getElementById('review-notes')?.value;
        await this.api._post(`/api/hitl/approvals/${id}/reject`, { reviewer_id: 'admin', reason: notes });
        showToast('Rejected', 'success');
        panel.style.display = 'none';
        this._fetchData();
      });

      panel.scrollIntoView({ behavior: 'smooth' });
    } catch (err) { showToast(`Failed to load: ${err.message}`, 'error'); }
  }

  _cleanup() {
    this._unsubs.forEach(fn => fn());
    this._unsubs = [];
  }
}
