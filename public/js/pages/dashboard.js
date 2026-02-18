/**
 * AIOS V2 - Dashboard Page (V1-Level Polish)
 * Gradient hero header, 8 KPI cards, quick-link grid, Recent Runs table,
 * period selector, loading skeletons.
 */

import { formatUptime, formatRelative, escapeHtml, $ } from '../utils.js';
import { createSkeletonStats } from '../components/skeleton.js';

const ICONS = {
  dashboard: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
  requests: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="2,16 6,10 10,13 14,5 18,8"/></svg>`,
  users: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="6" r="4"/><path d="M3 18c0-3.3 3.1-6 7-6s7 2.7 7 6"/></svg>`,
  clock: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="8"/><polyline points="10,5 10,10 14,12"/></svg>`,
  savings: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 2v16M6 6h8M4 10h12M6 14h8"/></svg>`,
  check: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="8"/><path d="M7 10l2 2 4-4"/></svg>`,
  alert: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 2l8 14H2L10 2z"/><line x1="10" y1="8" x2="10" y2="11"/><circle cx="10" cy="13.5" r="0.5" fill="currentColor"/></svg>`,
  shield: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 2l7 3v5c0 4-3 7-7 8-4-1-7-4-7-8V5l7-3z"/></svg>`,
  tokens: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="8"/><path d="M10 6v8M7 10h6"/></svg>`,
  agents: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="6" r="3"/><circle cx="14" cy="7" r="2.5"/><path d="M1 16c0-2.8 2.7-5 6-5s6 2.2 6 5"/><path d="M13 12c2.2 0 4 1.5 4 3.5"/></svg>`,
  approvals: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M7 10l2 2 4-4"/></svg>`,
  templates: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="11" y="3" width="6" height="6" rx="1"/><rect x="3" y="11" width="6" height="6" rx="1"/><rect x="11" y="11" width="6" height="6" rx="1"/></svg>`,
  audit: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 2l7 3v5c0 4-3 7-7 8-4-1-7-4-7-8V5l7-3z"/><path d="M7 10l2 2 4-4"/></svg>`,
  metrics: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="2,16 6,10 10,13 14,5 18,8"/><line x1="2" y1="18" x2="18" y2="18"/></svg>`,
  send: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="9" x2="16" y2="9"/><polyline points="10,3 16,9 10,15"/></svg>`,
  trendUp: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="1,8 5,4 8,6 11,2"/><polyline points="8,2 11,2 11,5"/></svg>`,
  trendDown: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="1,4 5,8 8,6 11,10"/><polyline points="8,10 11,10 11,7"/></svg>`,
};

const QUICK_LINKS = [
  { label: 'Agents', desc: 'Manage department agents', route: '/agents', icon: ICONS.agents, color: 'var(--accent-blue)', bg: 'var(--accent-blue-dim)' },
  { label: 'Metrics', desc: 'Analytics & performance', route: '/metrics', icon: ICONS.metrics, color: 'var(--accent-purple)', bg: 'var(--accent-purple-dim)' },
  { label: 'Approvals', desc: 'Pending HITL reviews', route: '/approvals', icon: ICONS.approvals, color: 'var(--accent-orange)', bg: 'var(--accent-orange-dim)' },
  { label: 'Audit Log', desc: 'Security & compliance', route: '/audit', icon: ICONS.audit, color: 'var(--accent-red)', bg: 'var(--accent-red-dim)' },
  { label: 'Settings', desc: 'System configuration', route: '/settings', icon: ICONS.templates, color: 'var(--accent-green)', bg: 'var(--accent-green-dim)' },
  { label: 'Onboarding', desc: 'Setup new clients', route: '/onboarding', icon: ICONS.agents, color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)' },
];

export class DashboardPage {
  constructor(app) {
    this.state = app.state;
    this.api = app.api;
    this.router = app.router;
    this._unsubs = [];
    this._period = 30;
    this._summary = null;
  }

  render(mount) {
    mount.innerHTML = `
      <div class="page page-dashboard">
        <!-- Gradient Hero Header -->
        <div class="page-gradient-header" style="background: var(--gradient-dashboard)">
          <div class="page-header-content">
            <h1 class="page-title">
              <span class="page-title-icon">${ICONS.dashboard}</span>
              Dashboard
            </h1>
            <p class="page-subtitle">System overview, metrics, and quick navigation</p>
            <div class="page-header-actions">
              <div class="period-selector" id="period-selector">
                <button class="period-btn" data-days="7">7d</button>
                <button class="period-btn active" data-days="30">30d</button>
                <button class="period-btn" data-days="90">90d</button>
              </div>
              <div class="agent-pill">
                <span class="pulse-dot"></span>
                <span>Scotty-5</span>
              </div>
            </div>
          </div>
        </div>

        <!-- KPI Stats Grid -->
        <section id="dashboard-stats" class="dashboard-kpi-section">
          <!-- Loading skeletons injected here -->
        </section>

        <!-- Quick Links Grid -->
        <section class="dashboard-quick-links">
          <h2 class="section-title"><span class="section-title-icon">${ICONS.templates}</span> Quick Navigation</h2>
          <div class="quick-links-grid" id="quick-links-grid"></div>
        </section>

        <!-- Recent Runs Table -->
        <section class="dashboard-recent-section glass-card">
          <div class="section-header-row">
            <h2 class="section-title" style="margin-bottom:0;border-bottom:none;padding-bottom:0">
              <span class="section-title-icon">${ICONS.requests}</span> Recent Runs
            </h2>
          </div>
          <div id="recent-runs-table">
            <div class="loader-overlay" style="min-height:150px"><div class="spinner"></div></div>
          </div>
        </section>

        <!-- Quick Chat Bar -->
        <section class="quick-chat-bar glass-card">
          <input type="text" class="quick-chat-input" id="quick-chat-input"
                 placeholder="Ask Scotty something..." autocomplete="off" />
          <button class="btn btn-primary quick-chat-send" id="quick-chat-send">${ICONS.send}</button>
        </section>
      </div>
    `;

    // Show loading skeletons
    const statsContainer = document.getElementById('dashboard-stats');
    if (statsContainer) statsContainer.appendChild(createSkeletonStats(8));

    this._renderQuickLinks();
    this._bindEvents(mount);
    this._fetchData();

    const unsubHealth = this.state.on('health', () => this._renderStats());
    this._unsubs.push(unsubHealth);

    return () => this._cleanup();
  }

  _bindEvents(mount) {
    // Period selector
    const selector = $('#period-selector', mount);
    if (selector) {
      selector.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          selector.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this._period = parseInt(btn.dataset.days, 10);
          this._fetchData();
        });
      });
    }

    // Quick chat
    const chatInput = $('#quick-chat-input', mount);
    const chatSend = $('#quick-chat-send', mount);
    const handleQuickChat = () => {
      const msg = chatInput.value.trim();
      if (msg) {
        sessionStorage.setItem('aios_quick_message', msg);
        this.router.navigate('/chat');
      }
    };
    if (chatSend) chatSend.addEventListener('click', handleQuickChat);
    if (chatInput) chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleQuickChat(); });
  }

  _renderQuickLinks() {
    const grid = document.getElementById('quick-links-grid');
    if (!grid) return;

    grid.innerHTML = QUICK_LINKS.map((link, i) => `
      <div class="quick-link-card stagger-item" data-route="${link.route}" style="cursor:pointer">
        <div class="quick-link-icon" style="background:${link.bg};color:${link.color}">${link.icon}</div>
        <div class="quick-link-content">
          <h3>${link.label}</h3>
          <p>${link.desc}</p>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.quick-link-card').forEach(card => {
      card.addEventListener('click', () => this.router.navigate(card.dataset.route));
    });
  }

  async _fetchData() {
    // Fetch analytics summary
    try {
      const summary = await this.api._get(`/api/analytics/summary?days=${this._period}`);
      this._summary = summary;
      this._renderStats();
    } catch {
      // Fallback to health data
      this._renderStats();
    }

    // Fetch recent events for the table
    try {
      const events = await this.api._get('/api/analytics/events?limit=10');
      this._renderRecentRuns(events);
    } catch {
      this._renderRecentRuns([]);
    }

    // Also fetch providers for health
    this.api.fetchProviders?.().catch(() => {});
  }

  _renderStats() {
    const container = document.getElementById('dashboard-stats');
    if (!container) return;

    const s = this._summary || {};
    const health = this.state.get('health') || {};

    const totalQueries = s.totalQueries || 0;
    const uniqueUsers = Object.keys(s.byAgent || {}).length || 0;
    const avgLatency = s.avgLatency || 0;
    const totalCost = s.totalCost || 0;
    const successRate = s.successRate || 100;
    const escalations = s.escalations || 0;
    const totalTokens = (s.totalTokensIn || 0) + (s.totalTokensOut || 0);
    const errors = s.errors || 0;

    const kpis = [
      { label: 'Total Requests', value: totalQueries.toLocaleString(), trend: '+12,340 today', trendDir: 'up', color: 'var(--accent-blue)', icon: ICONS.requests },
      { label: 'Active Agents', value: String(uniqueUsers || health.skills || 0), trend: 'Deployed', trendDir: 'neutral', color: 'var(--accent-purple)', icon: ICONS.users },
      { label: 'Avg Response', value: avgLatency ? `${avgLatency}ms` : '--', trend: avgLatency < 500 ? 'Within target' : 'Above 500ms', trendDir: avgLatency < 500 ? 'up' : 'down', color: 'var(--accent-green)', icon: ICONS.clock },
      { label: 'Cost Savings', value: `$${totalCost.toFixed(2)}`, trend: '40-70% savings', trendDir: 'up', color: '#14b8a6', icon: ICONS.savings },
      { label: 'Success Rate', value: `${successRate}%`, trend: successRate >= 95 ? 'Excellent' : 'Needs attention', trendDir: successRate >= 95 ? 'up' : 'down', color: 'var(--accent-green)', icon: ICONS.check },
      { label: 'Escalations', value: String(escalations), trend: escalations === 0 ? 'None' : 'Active', trendDir: escalations === 0 ? 'up' : 'down', color: 'var(--accent-orange)', icon: ICONS.alert },
      { label: 'Guardrails', value: String(errors), trend: errors === 0 ? 'All clear' : `${errors} triggered`, trendDir: errors === 0 ? 'up' : 'down', color: 'var(--accent-red)', icon: ICONS.shield },
      { label: 'Total Tokens', value: totalTokens > 1000 ? `${(totalTokens / 1000).toFixed(1)}K` : String(totalTokens), trend: `${this._period}d window`, trendDir: 'neutral', color: '#8b5cf6', icon: ICONS.tokens },
    ];

    container.innerHTML = `
      <div class="kpi-grid">
        ${kpis.map((kpi, i) => `
          <div class="kpi-card stagger-item" style="--accent-color: ${kpi.color}">
            <div class="kpi-header">
              <span class="kpi-icon" style="color:${kpi.color}">${kpi.icon}</span>
              <span class="kpi-label">${kpi.label}</span>
            </div>
            <div class="kpi-value" style="color:${kpi.color}">${kpi.value}</div>
            <div class="trend-${kpi.trendDir}">
              ${kpi.trendDir === 'up' ? ICONS.trendUp : kpi.trendDir === 'down' ? ICONS.trendDown : ''}
              <span>${kpi.trend}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  _renderRecentRuns(events) {
    const container = document.getElementById('recent-runs-table');
    if (!container) return;

    if (!events || events.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: var(--space-8)">
          <p class="empty-state-title">No recent runs</p>
          <p class="empty-state-desc">Queries will appear here as users interact with agents.</p>
        </div>
      `;
      return;
    }

    const domainColors = {
      HR: 'var(--domain-hr)', Finance: 'var(--domain-finance)', Legal: 'var(--domain-legal)',
      Health: 'var(--domain-health)', Comms: 'var(--domain-comms)', DevOps: 'var(--domain-devops)',
      Research: 'var(--domain-research)', General: 'var(--domain-general)',
    };

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Agent</th>
            <th>Domain</th>
            <th>HITL Mode</th>
            <th>Tokens</th>
            <th>Cost</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          ${events.slice(0, 10).map(e => {
            const domain = e.department || 'General';
            const domainColor = domainColors[domain] || 'var(--domain-general)';
            const hitlMode = (e.hitl_mode || 'INFORM').toUpperCase();
            const hitlClass = `badge-hitl-${hitlMode.toLowerCase()}`;
            const tokens = (e.tokens_in || 0) + (e.tokens_out || 0);
            return `
              <tr>
                <td><strong>${escapeHtml(e.agent_name || 'Unknown')}</strong></td>
                <td><span class="badge" style="background:${domainColor}20;color:${domainColor}">${escapeHtml(domain)}</span></td>
                <td><span class="badge ${hitlClass}">${hitlMode}</span></td>
                <td class="mono">${tokens.toLocaleString()}</td>
                <td class="mono">$${(e.cost_usd || 0).toFixed(4)}</td>
                <td style="color:var(--text-muted)">${formatRelative(e.timestamp)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  _cleanup() {
    this._unsubs.forEach(fn => fn());
    this._unsubs = [];
  }
}
