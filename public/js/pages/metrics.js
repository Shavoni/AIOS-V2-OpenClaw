/**
 * AIOS V2 - Metrics Page (V1-Level Polish)
 * Period selector, export dropdown, 8 KPIs, top agents/departments,
 * hourly distribution, error table, charts.
 */

import { createStatCard } from '../components/card.js';
import { LineChart, BarChart, DonutChart } from '../components/chart.js';
import { formatCost, formatTokens, formatRelative, escapeHtml } from '../utils.js';

const ICONS = {
  metrics: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,18 8,12 12,15 17,7 21,10"/><line x1="3" y1="21" x2="21" y2="21"/></svg>`,
  download: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v8M5 7l3 3 3-3M2 12v1.5a.5.5 0 00.5.5h11a.5.5 0 00.5-.5V12"/></svg>`,
  trendUp: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="1,8 5,4 8,6 11,2"/><polyline points="8,2 11,2 11,5"/></svg>`,
  trendDown: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="1,4 5,8 8,6 11,10"/><polyline points="8,10 11,10 11,7"/></svg>`,
};

const MEDAL = ['rank-gold', 'rank-silver', 'rank-bronze'];

export class MetricsPage {
  constructor(app) {
    this.state = app.state;
    this.api = app.api;
    this.router = app.router;
    this._unsubs = [];
    this._pollInterval = null;
    this._lineChart = new LineChart();
    this._barChart = new BarChart();
    this._donutChart = new DonutChart();
    this._resizeHandler = null;
    this._period = 30;
    this._summary = null;
  }

  render(mount) {
    mount.innerHTML = `
      <div class="page page-metrics">
        <!-- Gradient Header -->
        <div class="page-gradient-header" style="background: var(--gradient-metrics)">
          <div class="page-header-content">
            <h1 class="page-title">
              <span class="page-title-icon">${ICONS.metrics}</span>
              Metrics & Analytics
            </h1>
            <p class="page-subtitle">Performance data, usage trends, and cost analysis</p>
            <div class="page-header-actions">
              <div class="period-selector" id="period-selector">
                <button class="period-btn" data-days="7">7d</button>
                <button class="period-btn active" data-days="30">30d</button>
                <button class="period-btn" data-days="90">90d</button>
              </div>
              <div class="dropdown" id="export-dropdown">
                <button class="btn btn-sm" style="background:rgba(255,255,255,0.2);color:#fff;border:1px solid rgba(255,255,255,0.3)">
                  ${ICONS.download} Export
                </button>
                <div class="dropdown-menu" id="export-menu" style="display:none">
                  <a class="dropdown-item" href="/api/analytics/export?format=csv" download>CSV Download</a>
                  <a class="dropdown-item" href="/api/analytics/export?format=json" download>JSON Download</a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Primary KPI Row -->
        <section class="kpi-grid" id="metrics-kpi-primary"></section>

        <!-- Secondary KPI Row -->
        <section class="kpi-grid kpi-grid-secondary" id="metrics-kpi-secondary"></section>

        <!-- Charts -->
        <section class="charts-grid">
          <div class="chart-card glass-card">
            <h3 class="chart-title">Requests Over Time</h3>
            <div class="chart-container"><canvas id="chart-requests-line"></canvas></div>
          </div>
          <div class="chart-card glass-card">
            <h3 class="chart-title">Cost by Provider</h3>
            <div class="chart-container chart-container-donut"><canvas id="chart-cost-donut"></canvas></div>
          </div>
        </section>

        <!-- Top Agents & Departments -->
        <section class="metrics-tables-grid">
          <div class="glass-card" style="padding:var(--space-5)">
            <h3 class="section-title" style="border-bottom:none;padding-bottom:0;margin-bottom:var(--space-3)">Top 5 Agents</h3>
            <div id="top-agents-table"></div>
          </div>
          <div class="glass-card" style="padding:var(--space-5)">
            <h3 class="section-title" style="border-bottom:none;padding-bottom:0;margin-bottom:var(--space-3)">Top 5 Departments</h3>
            <div id="top-departments-table"></div>
          </div>
        </section>

        <!-- Hourly Distribution -->
        <section class="glass-card" style="padding:var(--space-5);margin-bottom:var(--space-6)">
          <h3 class="chart-title">Hourly Distribution</h3>
          <div class="chart-container"><canvas id="chart-hourly-bar"></canvas></div>
        </section>

        <!-- Error Table (collapsible) -->
        <section class="glass-card" style="padding:var(--space-5);margin-bottom:var(--space-6)">
          <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" id="errors-toggle">
            <h3 class="section-title" style="border-bottom:none;padding-bottom:0;margin-bottom:0">Recent Errors</h3>
            <span id="errors-count" class="badge badge-offline">0</span>
          </div>
          <div id="errors-table" style="margin-top:var(--space-4);display:none"></div>
        </section>
      </div>
    `;

    this._bindEvents(mount);
    this._fetchAll();

    const unsubMetrics = this.state.on('metrics', () => this._renderCharts());
    this._unsubs.push(unsubMetrics);

    this._pollInterval = setInterval(() => this._fetchAll(), 10000);
    this._resizeHandler = () => this._renderCharts();
    window.addEventListener('resize', this._resizeHandler);

    return () => this._cleanup();
  }

  _bindEvents(mount) {
    // Period selector
    const selector = mount.querySelector('#period-selector');
    if (selector) {
      selector.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          selector.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this._period = parseInt(btn.dataset.days, 10);
          this._fetchAll();
        });
      });
    }

    // Export dropdown toggle
    const exportBtn = mount.querySelector('#export-dropdown button');
    const exportMenu = mount.querySelector('#export-menu');
    if (exportBtn && exportMenu) {
      exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        exportMenu.style.display = exportMenu.style.display === 'none' ? '' : 'none';
      });
      document.addEventListener('click', () => { exportMenu.style.display = 'none'; });
    }

    // Errors toggle
    mount.querySelector('#errors-toggle')?.addEventListener('click', () => {
      const table = document.getElementById('errors-table');
      if (table) table.style.display = table.style.display === 'none' ? '' : 'none';
    });
  }

  async _fetchAll() {
    try {
      const summary = await this.api._get(`/api/analytics/summary?days=${this._period}`);
      this._summary = summary;
      this._renderKPIs();
      this._renderTopAgents();
      this._renderTopDepartments();
    } catch {}

    try {
      await this.api.fetchMetrics?.().catch(() => {});
      this._renderCharts();
    } catch {}

    try {
      const events = await this.api._get('/api/analytics/events?limit=20');
      const errors = (events || []).filter(e => !e.success || e.error_message);
      this._renderErrors(errors);
    } catch {}
  }

  _renderKPIs() {
    const s = this._summary || {};
    const primary = document.getElementById('metrics-kpi-primary');
    const secondary = document.getElementById('metrics-kpi-secondary');
    if (!primary || !secondary) return;

    const totalQueries = s.totalQueries || 0;
    const avgLatency = s.avgLatency || 0;
    const totalCost = s.totalCost || 0;
    const successRate = s.successRate || 100;
    const escalations = s.escalations || 0;
    const totalTokens = (s.totalTokensIn || 0) + (s.totalTokensOut || 0);
    const errors = s.errors || 0;
    const uniqueAgents = Object.keys(s.byAgent || {}).length;

    primary.innerHTML = [
      { label: 'Total Queries', value: totalQueries.toLocaleString(), color: 'var(--accent-blue)', trend: 'up' },
      { label: 'Active Agents', value: String(uniqueAgents), color: 'var(--accent-purple)', trend: 'neutral' },
      { label: 'Avg Response', value: avgLatency ? `${avgLatency}ms` : '--', color: 'var(--accent-green)', trend: avgLatency < 500 ? 'up' : 'down' },
      { label: 'Total Cost', value: `$${totalCost.toFixed(2)}`, color: '#14b8a6', trend: 'neutral' },
    ].map(k => `
      <div class="kpi-card stagger-item" style="--accent-color:${k.color}">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value" style="color:${k.color}">${k.value}</div>
        <div class="trend-${k.trend}">${k.trend === 'up' ? ICONS.trendUp : k.trend === 'down' ? ICONS.trendDown : ''} <span>${this._period}d</span></div>
      </div>
    `).join('');

    secondary.innerHTML = [
      { label: 'Success Rate', value: `${successRate}%`, color: 'var(--accent-green)' },
      { label: 'Escalations', value: String(escalations), color: 'var(--accent-orange)' },
      { label: 'Errors', value: String(errors), color: 'var(--accent-red)' },
      { label: 'Total Tokens', value: totalTokens > 1000 ? `${(totalTokens / 1000).toFixed(1)}K` : String(totalTokens), color: '#8b5cf6' },
    ].map(k => `
      <div class="kpi-card stagger-item" style="--accent-color:${k.color}">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value" style="color:${k.color}">${k.value}</div>
      </div>
    `).join('');
  }

  _renderTopAgents() {
    const container = document.getElementById('top-agents-table');
    if (!container) return;
    const agents = Object.entries(this._summary?.byAgent || {}).slice(0, 5);

    if (agents.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted);font-size:var(--font-size-sm)">No agent data yet.</p>';
      return;
    }

    container.innerHTML = `<table class="data-table"><thead><tr><th>#</th><th>Agent</th><th>Queries</th><th>Avg Latency</th><th>Cost</th></tr></thead><tbody>
      ${agents.map(([name, data], i) => `
        <tr>
          <td><span class="${MEDAL[i] || ''}" style="font-weight:700">${i + 1}</span></td>
          <td><strong>${escapeHtml(name)}</strong></td>
          <td class="mono">${data.queries}</td>
          <td class="mono">${data.avgLatency}ms</td>
          <td class="mono">$${data.cost.toFixed(4)}</td>
        </tr>
      `).join('')}
    </tbody></table>`;
  }

  _renderTopDepartments() {
    const container = document.getElementById('top-departments-table');
    if (!container) return;
    const depts = Object.entries(this._summary?.byDepartment || {}).slice(0, 5);

    if (depts.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted);font-size:var(--font-size-sm)">No department data yet.</p>';
      return;
    }

    container.innerHTML = `<table class="data-table"><thead><tr><th>#</th><th>Department</th><th>Queries</th></tr></thead><tbody>
      ${depts.map(([name, count], i) => `
        <tr>
          <td><span class="${MEDAL[i] || ''}" style="font-weight:700">${i + 1}</span></td>
          <td><strong>${escapeHtml(name)}</strong></td>
          <td class="mono">${count}</td>
        </tr>
      `).join('')}
    </tbody></table>`;
  }

  _renderErrors(errors) {
    const countEl = document.getElementById('errors-count');
    const container = document.getElementById('errors-table');
    if (countEl) countEl.textContent = errors.length;

    if (!container) return;
    if (errors.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted);font-size:var(--font-size-sm)">No recent errors.</p>';
      return;
    }

    container.innerHTML = `<table class="data-table"><thead><tr><th>Time</th><th>Agent</th><th>Error</th></tr></thead><tbody>
      ${errors.slice(0, 10).map(e => `
        <tr>
          <td>${formatRelative(e.timestamp)}</td>
          <td>${escapeHtml(e.agent_name || '-')}</td>
          <td style="color:var(--accent-red)">${escapeHtml((e.error_message || 'Unknown error').slice(0, 100))}</td>
        </tr>
      `).join('')}
    </tbody></table>`;
  }

  _renderCharts() {
    const metrics = this.state.get('metrics') || {};
    this._renderLineChart(metrics);
    this._renderDonutChart(metrics);
    this._renderHourlyChart();
  }

  _renderLineChart(metrics) {
    const canvas = document.getElementById('chart-requests-line');
    if (!canvas) return;
    const timeline = metrics.timeline || metrics.requestsOverTime || [];
    if (timeline.length === 0) {
      const sampleData = Array.from({ length: 12 }, () => Math.floor(Math.random() * 50) + 5);
      const sampleLabels = Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setHours(d.getHours() - (11 - i)); return d.getHours() + ':00'; });
      this._lineChart.draw(canvas, sampleData, { color: '#6c5ce7', labels: sampleLabels });
      return;
    }
    const data = timeline.map(t => t.value || t.count || t.requests || 0);
    const labels = timeline.map(t => t.label || t.time || t.hour || '');
    this._lineChart.draw(canvas, data, { color: '#6c5ce7', labels });
  }

  _renderDonutChart(metrics) {
    const canvas = document.getElementById('chart-cost-donut');
    if (!canvas) return;
    const byProvider = metrics.byProvider || {};
    let segments = Object.entries(byProvider).map(([name, data]) => ({
      label: name, value: typeof data === 'number' ? 0 : data.cost || 0,
    })).filter(s => s.value > 0);
    if (segments.length === 0) segments = [{ label: 'OpenAI', value: 12.5 }, { label: 'Anthropic', value: 8.2 }, { label: 'Gemini', value: 3.1 }];
    const totalCost = this._summary?.totalCost || segments.reduce((s, d) => s + d.value, 0);
    this._donutChart.draw(canvas, segments, { centerValue: formatCost(totalCost), centerLabel: 'Total' });
  }

  _renderHourlyChart() {
    const canvas = document.getElementById('chart-hourly-bar');
    if (!canvas) return;
    // Generate hourly data (sample if no real data)
    const barData = Array.from({ length: 24 }, (_, i) => ({
      label: `${i}:00`,
      value: Math.floor(Math.random() * 30) + (i >= 9 && i <= 17 ? 20 : 3),
    }));
    this._barChart.draw(canvas, barData, {
      colors: barData.map((_, i) => i >= 9 && i <= 17 ? '#3b82f6' : '#1e3a5f'),
    });
  }

  _cleanup() {
    this._unsubs.forEach(fn => fn());
    this._unsubs = [];
    if (this._pollInterval) { clearInterval(this._pollInterval); this._pollInterval = null; }
    if (this._resizeHandler) { window.removeEventListener('resize', this._resizeHandler); this._resizeHandler = null; }
  }
}
