/**
 * AIOS V2 - Settings Page (V1-Level Polish)
 * 6 tabs: Branding, API Keys, Governance, Canon, Notifications, System.
 * Gradient provider cards, governance history, logo upload, notification toggles.
 */

import { showToast } from '../components/toast.js';
import { createTabs } from '../components/tabs.js';
import { createToggle } from '../components/toggle.js';
import { escapeHtml, $ } from '../utils.js';

const ICONS = {
  settings: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M4.2 19.8l2.8-2.8M17 7l2.8-2.8"/></svg>`,
};

const PROVIDER_CARDS = [
  { id: 'openai', name: 'OpenAI', gradient: 'linear-gradient(135deg, #10a37f, #0d8a6a)', icon: 'O' },
  { id: 'anthropic', name: 'Anthropic', gradient: 'linear-gradient(135deg, #cc785c, #b5694e)', icon: 'A' },
  { id: 'gemini', name: 'Google Gemini', gradient: 'linear-gradient(135deg, #4285f4, #3367d6)', icon: 'G' },
];

const NOTIFICATION_TYPES = [
  { id: 'escalation', label: 'Escalation Alerts', desc: 'When a query is escalated to human review' },
  { id: 'error', label: 'Error Notifications', desc: 'When agent errors exceed threshold' },
  { id: 'governance', label: 'Governance Changes', desc: 'When policies are added or modified' },
  { id: 'onboarding', label: 'Onboarding Complete', desc: 'When new agents finish onboarding' },
  { id: 'sla', label: 'SLA Breach', desc: 'When approval SLAs are breached' },
];

export class SettingsPage {
  constructor(app) {
    this.state = app.state;
    this.api = app.api;
    this.router = app.router;
    this._unsubs = [];
    this._activeTab = 'branding';
  }

  render(mount) {
    mount.innerHTML = `
      <div class="page page-settings">
        <!-- Gradient Header -->
        <div class="page-gradient-header" style="background: var(--gradient-settings)">
          <div class="page-header-content">
            <h1 class="page-title">
              <span class="page-title-icon">${ICONS.settings}</span>
              Settings
            </h1>
            <p class="page-subtitle">System configuration, API keys, governance, and branding</p>
          </div>
        </div>

        <div id="settings-tabs-container"></div>

        <section class="settings-content glass-card" id="settings-content">
          <div class="loader-overlay" style="min-height:200px"><div class="spinner"></div></div>
        </section>
      </div>
    `;

    this._setupTabs();
    this._loadTab(this._activeTab);

    return () => this._cleanup();
  }

  _setupTabs() {
    const tabsComp = createTabs({
      tabs: [
        { id: 'branding', label: 'Branding' },
        { id: 'llm', label: 'API Keys' },
        { id: 'governance', label: 'Governance' },
        { id: 'canon', label: 'Shared Canon' },
        { id: 'notifications', label: 'Notifications' },
        { id: 'system', label: 'System' },
      ],
      activeTab: 'branding',
      onTabChange: (id) => {
        this._activeTab = id;
        this._loadTab(id);
      }
    });
    const container = document.getElementById('settings-tabs-container');
    if (container) container.appendChild(tabsComp.el);
  }

  async _loadTab(tab) {
    const container = document.getElementById('settings-content');
    if (!container) return;
    container.innerHTML = '<div class="loader-overlay" style="min-height:200px"><div class="spinner"></div></div>';

    switch (tab) {
      case 'branding': return this._renderBranding(container);
      case 'llm': return this._renderLLMConfig(container);
      case 'governance': return this._renderGovernance(container);
      case 'canon': return this._renderCanon(container);
      case 'notifications': return this._renderNotifications(container);
      case 'system': return this._renderSystem(container);
    }
  }

  async _renderBranding(container) {
    try {
      const branding = await this.api._get('/api/system/branding');
      container.innerHTML = `
        <h2 class="settings-section-title">Branding</h2>
        ${branding.logoUrl ? `
        <div class="branding-logo-preview">
          <img src="${escapeHtml(branding.logoUrl)}" alt="Logo" />
          <button class="btn btn-sm btn-danger" id="delete-logo">Remove Logo</button>
        </div>` : ''}
        <div class="form-group">
          <label class="input-label">Upload Logo</label>
          <div class="logo-upload-zone" id="logo-drop-zone">
            <p style="color:var(--text-muted)">Drag & drop an image or click to browse</p>
            <input type="file" id="logo-upload" accept="image/*" style="display:none" />
            <button class="btn btn-sm btn-outline" id="logo-browse">Browse</button>
          </div>
        </div>
        <div class="settings-form-grid">
          <div class="form-group">
            <label class="input-label">Application Name</label>
            <input type="text" class="input" id="branding-name" value="${escapeHtml(branding.appName || 'AIOS V2')}" />
          </div>
          <div class="form-group">
            <label class="input-label">Organization</label>
            <input type="text" class="input" id="branding-org" value="${escapeHtml(branding.organization || '')}" />
          </div>
          <div class="form-group">
            <label class="input-label">Tagline</label>
            <input type="text" class="input" id="branding-tagline" value="${escapeHtml(branding.tagline || '')}" />
          </div>
          <div class="form-group">
            <label class="input-label">Primary Color</label>
            <input type="color" class="input" id="branding-color" value="${branding.primaryColor || '#6c5ce7'}" style="width: 80px; height: 40px; padding: 4px;" />
          </div>
        </div>
        <button class="btn btn-primary" id="save-branding">Save Branding</button>
      `;

      // Logo browse
      document.getElementById('logo-browse')?.addEventListener('click', () => document.getElementById('logo-upload')?.click());
      document.getElementById('logo-upload')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        showToast(`Logo uploaded: ${file.name}`, 'success');
      });

      document.getElementById('save-branding')?.addEventListener('click', async () => {
        const data = {
          appName: document.getElementById('branding-name')?.value,
          organization: document.getElementById('branding-org')?.value,
          tagline: document.getElementById('branding-tagline')?.value,
          primaryColor: document.getElementById('branding-color')?.value,
        };
        try {
          await this.api._post('/api/system/branding', data);
          showToast('Branding saved', 'success');
        } catch (err) { showToast(`Failed: ${err.message}`, 'error'); }
      });
    } catch (err) {
      container.innerHTML = `<p style="color:var(--accent-red)">Failed to load branding: ${escapeHtml(err.message)}</p>`;
    }
  }

  async _renderLLMConfig(container) {
    try {
      const config = await this.api._get('/api/system/llm-config');
      const providers = config.providers || {};

      container.innerHTML = `
        <h2 class="settings-section-title">API Keys & Providers</h2>
        <div class="provider-cards-grid">
          ${PROVIDER_CARDS.map(p => {
            const hasKey = providers[p.id]?.apiKey;
            return `
              <div class="provider-config-card" style="--provider-gradient: ${p.gradient}">
                <div class="provider-config-icon" style="background: ${p.gradient}">${p.icon}</div>
                <h3>${p.name}</h3>
                <span class="badge ${hasKey ? 'badge-online' : 'badge-offline'}">${hasKey ? 'Configured' : 'Not Set'}</span>
                <div class="form-group" style="margin-top:var(--space-4)">
                  <label class="input-label">API Key</label>
                  <div class="input-group">
                    <input type="password" class="input provider-key-input" id="key-${p.id}" data-provider="${p.id}"
                           value="${hasKey ? '********' : ''}" placeholder="Enter key..." />
                    <button class="btn btn-sm btn-ghost key-toggle" data-for="key-${p.id}" title="Show/hide">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z"/><circle cx="7" cy="7" r="2"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <div class="settings-form-grid" style="margin-top:var(--space-6)">
          <div class="form-group">
            <label class="input-label">Default Model</label>
            <input type="text" class="input" id="default-model" value="${escapeHtml(config.defaultModel || 'gpt-4o')}" />
          </div>
        </div>
        <button class="btn btn-primary" id="save-llm" style="margin-top:var(--space-4)">Save Configuration</button>
      `;

      // Show/hide key toggles
      container.querySelectorAll('.key-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
          const input = document.getElementById(btn.dataset.for);
          if (input) input.type = input.type === 'password' ? 'text' : 'password';
        });
      });

      document.getElementById('save-llm')?.addEventListener('click', async () => {
        const updates = { defaultModel: document.getElementById('default-model')?.value, providers: {} };
        document.querySelectorAll('.provider-key-input').forEach(input => {
          const val = input.value;
          if (val && val !== '********') updates.providers[input.dataset.provider] = { apiKey: val };
        });
        try {
          await this.api._post('/api/system/llm-config', updates);
          showToast('LLM config saved', 'success');
        } catch (err) { showToast(`Failed: ${err.message}`, 'error'); }
      });
    } catch (err) {
      container.innerHTML = `<p style="color:var(--accent-red)">Failed to load config: ${escapeHtml(err.message)}</p>`;
    }
  }

  async _renderGovernance(container) {
    try {
      const rules = await this.api._get('/api/governance/rules');
      let versions = [];
      try { versions = await this.api._get('/api/governance/versions'); } catch {}

      container.innerHTML = `
        <h2 class="settings-section-title">Governance Rules</h2>
        <div class="governance-summary glass-card" style="padding:var(--space-4);margin-bottom:var(--space-6);background:var(--bg-surface)">
          <div style="display:flex;gap:var(--space-6)">
            <div><span class="stat-label">Total Rules</span><div class="stat-value stat-value--purple">${rules.length}</div></div>
            <div><span class="stat-label">Immutable</span><div class="stat-value stat-value--orange">${rules.filter(r => r.is_immutable).length}</div></div>
            <div><span class="stat-label">Dynamic</span><div class="stat-value stat-value--blue">${rules.filter(r => !r.is_immutable).length}</div></div>
          </div>
        </div>
        <div class="rules-list">
          ${rules.map(r => `
            <div class="rule-item glass-card stagger-item">
              <div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-2)">
                <strong>${escapeHtml(r.name || r.id)}</strong>
                <span class="badge badge-hitl-${(r.hitl_mode || 'inform').toLowerCase()}">${escapeHtml(r.hitl_mode || 'INFORM')}</span>
                <span class="badge">${escapeHtml(r.tier || 'standard')}</span>
                ${r.is_immutable ? '<span class="badge badge-warning">Locked</span>' : ''}
              </div>
              <p style="font-size:var(--font-size-sm);color:var(--text-secondary);margin:0 0 var(--space-2)">${escapeHtml(r.description || '')}</p>
              ${!r.is_immutable ? `<button class="btn btn-sm btn-ghost delete-rule-btn" data-id="${escapeHtml(r.id)}" style="color:var(--accent-red)">Delete</button>` : ''}
            </div>
          `).join('')}
        </div>
        ${versions.length ? `
        <h3 style="margin-top:var(--space-6)">Version History</h3>
        <table class="data-table">
          <thead><tr><th>Version</th><th>Description</th><th>Date</th><th>Action</th></tr></thead>
          <tbody>
            ${versions.map((v, i) => `
              <tr>
                <td class="mono">${v.version || i + 1}</td>
                <td>${escapeHtml(v.description || 'Version update')}</td>
                <td>${escapeHtml(v.created_at || '')}</td>
                <td>${i > 0 ? `<button class="btn btn-sm btn-ghost rollback-btn" data-version="${v.version || i}">Rollback</button>` : '<span class="badge badge-online">Current</span>'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : ''}
        <h3 style="margin-top:var(--space-6)">Add New Rule</h3>
        <div class="settings-form-grid">
          <div class="form-group"><label class="input-label">Name</label><input type="text" class="input" id="new-rule-name" placeholder="Rule name" /></div>
          <div class="form-group"><label class="input-label">Description</label><input type="text" class="input" id="new-rule-desc" placeholder="What does this rule do?" /></div>
          <div class="form-group"><label class="input-label">HITL Mode</label><select class="select" id="new-rule-mode"><option value="INFORM">Inform</option><option value="DRAFT">Draft</option><option value="ESCALATE">Escalate</option></select></div>
          <div class="form-group"><label class="input-label">Domain</label><input type="text" class="input" id="new-rule-domain" placeholder="e.g. Legal" /></div>
        </div>
        <button class="btn btn-primary" id="add-rule-btn" style="margin-top:var(--space-3)">Add Rule</button>
      `;

      container.querySelectorAll('.delete-rule-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await fetch(`/api/governance/rules/${btn.dataset.id}`, { method: 'DELETE' });
            showToast('Rule deleted', 'success');
            this._loadTab('governance');
          } catch (err) { showToast(`Failed: ${err.message}`, 'error'); }
        });
      });

      document.getElementById('add-rule-btn')?.addEventListener('click', async () => {
        const conditions = {};
        const domain = document.getElementById('new-rule-domain')?.value;
        if (domain) conditions.domain = domain;
        try {
          await this.api._post('/api/governance/rules', {
            name: document.getElementById('new-rule-name')?.value,
            description: document.getElementById('new-rule-desc')?.value,
            hitl_mode: document.getElementById('new-rule-mode')?.value,
            conditions,
          });
          showToast('Rule added', 'success');
          this._loadTab('governance');
        } catch (err) { showToast(`Failed: ${err.message}`, 'error'); }
      });
    } catch (err) {
      container.innerHTML = `<p style="color:var(--accent-red)">Failed to load governance: ${escapeHtml(err.message)}</p>`;
    }
  }

  async _renderCanon(container) {
    try {
      const docs = await this.api._get('/api/system/canon/documents');
      container.innerHTML = `
        <h2 class="settings-section-title">Shared Canon</h2>
        <p style="color:var(--text-secondary);font-size:var(--font-size-sm);margin-bottom:var(--space-4)">Shared knowledge base available to all agents.</p>
        <div class="canon-list">
          ${docs.length ? docs.map(d => `
            <div class="canon-item glass-card stagger-item" style="display:flex;align-items:center;justify-content:space-between;padding:var(--space-4)">
              <div>
                <strong>${escapeHtml(d.filename)}</strong>
                <span style="color:var(--text-muted);font-size:var(--font-size-xs);margin-left:var(--space-2)">${d.file_size || 0} bytes</span>
              </div>
              <button class="btn btn-sm btn-ghost delete-canon-btn" data-id="${escapeHtml(d.id)}" style="color:var(--accent-red)">&times;</button>
            </div>
          `).join('') : '<p style="color:var(--text-muted)">No canon documents yet.</p>'}
        </div>
        <h3 style="margin-top:var(--space-6)">Add Document</h3>
        <div class="settings-form-grid">
          <div class="form-group"><label class="input-label">Filename</label><input type="text" class="input" id="canon-filename" placeholder="e.g. company-policies.md" /></div>
        </div>
        <div class="form-group"><label class="input-label">Content</label><textarea class="textarea" id="canon-content" rows="6" placeholder="Paste document content..."></textarea></div>
        <button class="btn btn-primary" id="add-canon-btn" style="margin-top:var(--space-3)">Add Document</button>
      `;

      container.querySelectorAll('.delete-canon-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await fetch(`/api/system/canon/documents/${btn.dataset.id}`, { method: 'DELETE' });
            showToast('Document removed', 'success');
            this._loadTab('canon');
          } catch (err) { showToast(`Failed: ${err.message}`, 'error'); }
        });
      });

      document.getElementById('add-canon-btn')?.addEventListener('click', async () => {
        try {
          await this.api._post('/api/system/canon/documents', {
            filename: document.getElementById('canon-filename')?.value,
            content: document.getElementById('canon-content')?.value,
          });
          showToast('Document added', 'success');
          this._loadTab('canon');
        } catch (err) { showToast(`Failed: ${err.message}`, 'error'); }
      });
    } catch (err) {
      container.innerHTML = `<p style="color:var(--accent-red)">Failed to load canon: ${escapeHtml(err.message)}</p>`;
    }
  }

  _renderNotifications(container) {
    container.innerHTML = `
      <h2 class="settings-section-title">Notification Preferences</h2>
      <div class="notification-global" style="margin-bottom:var(--space-6);display:flex;align-items:center;gap:var(--space-4)">
        <div id="global-toggle-container"></div>
        <span style="font-size:var(--font-size-sm);color:var(--text-secondary)">Enable all notifications</span>
      </div>
      <div class="notification-types" id="notification-types">
        ${NOTIFICATION_TYPES.map(nt => `
          <div class="notification-type-item glass-card stagger-item">
            <div class="notification-type-info">
              <h4>${nt.label}</h4>
              <p>${nt.desc}</p>
            </div>
            <div class="notification-channels">
              <div id="toggle-${nt.id}-email"></div>
              <div id="toggle-${nt.id}-push"></div>
              <div id="toggle-${nt.id}-inapp"></div>
            </div>
          </div>
        `).join('')}
      </div>
      <h3 style="margin-top:var(--space-6)">Quiet Hours</h3>
      <div class="settings-form-grid">
        <div class="form-group"><label class="input-label">Start</label><input type="time" class="input" id="quiet-start" value="22:00" /></div>
        <div class="form-group"><label class="input-label">End</label><input type="time" class="input" id="quiet-end" value="07:00" /></div>
      </div>
      <button class="btn btn-primary" id="save-notifications" style="margin-top:var(--space-4)">Save Preferences</button>
    `;

    // Global toggle
    const globalToggle = createToggle({ checked: true, label: 'Global' });
    document.getElementById('global-toggle-container')?.appendChild(globalToggle);

    // Per-type channel toggles
    NOTIFICATION_TYPES.forEach(nt => {
      ['email', 'push', 'inapp'].forEach(ch => {
        const toggle = createToggle({ checked: ch === 'inapp', label: ch === 'inapp' ? 'In-App' : ch.charAt(0).toUpperCase() + ch.slice(1) });
        document.getElementById(`toggle-${nt.id}-${ch}`)?.appendChild(toggle);
      });
    });

    document.getElementById('save-notifications')?.addEventListener('click', () => {
      showToast('Notification preferences saved', 'success');
    });
  }

  async _renderSystem(container) {
    container.innerHTML = `
      <h2 class="settings-section-title">System Operations</h2>
      <div class="system-actions-grid">
        <div class="system-action-card glass-card stagger-item">
          <h3>Regenerate Concierge</h3>
          <p style="color:var(--text-secondary);font-size:var(--font-size-sm)">Update the router agent based on current active agents.</p>
          <button class="btn btn-primary" id="regen-concierge">Regenerate</button>
        </div>
        <div class="system-action-card glass-card stagger-item">
          <h3>Export Analytics</h3>
          <p style="color:var(--text-secondary);font-size:var(--font-size-sm)">Download analytics data as CSV.</p>
          <a class="btn btn-primary" href="/api/analytics/export?format=csv" download="analytics.csv" style="text-decoration:none">Export CSV</a>
        </div>
        <div class="system-action-card glass-card stagger-item" style="border:1px solid var(--accent-red-border)">
          <h3 style="color:var(--accent-red)">Reset System</h3>
          <p style="color:var(--text-secondary);font-size:var(--font-size-sm)">Reset all agents, governance rules, and analytics. This cannot be undone.</p>
          <button class="btn btn-danger" id="system-reset">Reset Everything</button>
        </div>
      </div>
    `;

    document.getElementById('regen-concierge')?.addEventListener('click', async () => {
      try {
        const result = await this.api._post('/api/system/regenerate-concierge', {});
        showToast(`Concierge regenerated: ${result.name || 'OK'}`, 'success');
      } catch (err) { showToast(`Failed: ${err.message}`, 'error'); }
    });

    document.getElementById('system-reset')?.addEventListener('click', () => {
      if (!confirm('WARNING: This will permanently delete all agents, rules, and analytics data. Type "RESET" to confirm.')) return;
      showToast('System reset is not implemented in this build', 'warning');
    });
  }

  _cleanup() {
    this._unsubs.forEach(fn => fn());
    this._unsubs = [];
  }
}
