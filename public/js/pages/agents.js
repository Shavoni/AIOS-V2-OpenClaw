/**
 * AIOS V2 - Agents Page (V1-Level Polish)
 * Concierge router card, domain gradients, kebab menus, knowledge sheet,
 * 3-tab create/edit form, HITL mode selector, stagger animations.
 */

import { showToast } from '../components/toast.js';
import { showModal, hideModal } from '../components/modal.js';
import { createDropdown } from '../components/dropdown.js';
import { createTabs } from '../components/tabs.js';
import { escapeHtml, $ } from '../utils.js';

const DOMAIN_COLORS = {
  HR: { color: 'var(--domain-hr)', dim: 'var(--domain-hr-dim)', gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' },
  Finance: { color: 'var(--domain-finance)', dim: 'var(--domain-finance-dim)', gradient: 'linear-gradient(135deg, #14b8a6, #0d9488)' },
  Legal: { color: 'var(--domain-legal)', dim: 'var(--domain-legal-dim)', gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)' },
  Health: { color: 'var(--domain-health)', dim: 'var(--domain-health-dim)', gradient: 'linear-gradient(135deg, #22c55e, #16a34a)' },
  Comms: { color: 'var(--domain-comms)', dim: 'var(--domain-comms-dim)', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)' },
  DevOps: { color: 'var(--domain-devops)', dim: 'var(--domain-devops-dim)', gradient: 'linear-gradient(135deg, #06b6d4, #0891b2)' },
  Research: { color: 'var(--domain-research)', dim: 'var(--domain-research-dim)', gradient: 'linear-gradient(135deg, #ec4899, #db2777)' },
  General: { color: 'var(--domain-general)', dim: 'var(--domain-general-dim)', gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)' },
};

const HITL_MODES = ['AUTO', 'DRAFT', 'REVIEW', 'ESCALATE'];

const ICONS = {
  agents: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6"/></svg>`,
  edit: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 2l2 2L5 11H3V9L10 2z"/></svg>`,
  book: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 2h3.5a2 2 0 012 2v8l-1-1H2V2z"/><path d="M12 2H8.5a2 2 0 00-2 2v8l1-1H12V2z"/></svg>`,
  test: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="7" r="5.5"/><path d="M5 7l1.5 1.5 3-3"/></svg>`,
  toggle: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="4" width="12" height="6" rx="3"/><circle cx="5" cy="7" r="2" fill="currentColor"/></svg>`,
  trash: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4h10M5 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4M4 6v5a1 1 0 001 1h4a1 1 0 001-1V6"/></svg>`,
  export: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 2v7M4 6l3-4 3 4M2 10v1.5a.5.5 0 00.5.5h9a.5.5 0 00.5-.5V10"/></svg>`,
  concierge: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"/><path d="M12 6v6l4 2"/></svg>`,
};

export class AgentsPage {
  constructor(app) {
    this.state = app.state;
    this.api = app.api;
    this.router = app.router;
    this._unsubs = [];
    this._agents = [];
  }

  render(mount) {
    mount.innerHTML = `
      <div class="page page-agents">
        <!-- Gradient Header -->
        <div class="page-gradient-header" style="background: var(--gradient-agents)">
          <div class="page-header-content">
            <h1 class="page-title">
              <span class="page-title-icon">${ICONS.agents}</span>
              Agents
            </h1>
            <p class="page-subtitle">Manage AI department agents, knowledge bases, and routing</p>
            <div class="page-header-actions">
              <button class="btn btn-sm" id="create-agent-btn" style="background:rgba(255,255,255,0.2);color:#fff;border:1px solid rgba(255,255,255,0.3)">+ New Agent</button>
            </div>
          </div>
        </div>

        <!-- Stats -->
        <section class="stat-grid" id="agents-stats"></section>

        <!-- Concierge Router Card -->
        <section id="concierge-section" style="display:none;margin-bottom:var(--space-6)"></section>

        <!-- Department Agents Grid -->
        <section>
          <h2 class="section-title" style="margin-top:var(--space-4)">Department Agents</h2>
          <div class="agents-grid" id="agents-grid">
            <div class="loader-overlay" style="min-height:200px"><div class="spinner"></div><span class="text-secondary">Loading agents...</span></div>
          </div>
        </section>

        <!-- Knowledge Sheet (hidden by default) -->
        <div id="knowledge-sheet-container"></div>
      </div>
    `;

    this._bindEvents(mount);
    this._fetchAgents();

    return () => this._cleanup();
  }

  _bindEvents(mount) {
    const createBtn = $('#create-agent-btn', mount);
    if (createBtn) createBtn.addEventListener('click', () => this._showCreateDialog());
  }

  async _fetchAgents() {
    try {
      const agents = await this.api._get('/api/agents');
      this._agents = agents;
      this._renderStats(agents);
      this._renderConcierge(agents);
      this._renderGrid(agents);
    } catch {
      const grid = document.getElementById('agents-grid');
      if (grid) grid.innerHTML = `<div class="empty-state"><p class="empty-state-title">No agents configured</p><p class="empty-state-desc">Click "New Agent" to create your first department agent.</p></div>`;
    }
  }

  _renderStats(agents) {
    const container = document.getElementById('agents-stats');
    if (!container) return;

    const active = agents.filter(a => a.status === 'active').length;
    const domains = new Set(agents.map(a => a.domain).filter(Boolean)).size;
    const router = agents.find(a => a.is_router);

    container.innerHTML = `
      <div class="stat-card glass-card stagger-item">
        <div class="stat-label">Total Agents</div>
        <div class="stat-value stat-value--purple">${agents.length}</div>
      </div>
      <div class="stat-card glass-card stagger-item">
        <div class="stat-label">Active</div>
        <div class="stat-value stat-value--green">${active}</div>
      </div>
      <div class="stat-card glass-card stagger-item">
        <div class="stat-label">Domains</div>
        <div class="stat-value stat-value--blue">${domains}</div>
      </div>
      <div class="stat-card glass-card stagger-item">
        <div class="stat-label">Concierge Router</div>
        <div class="stat-value stat-value--orange">${router ? 'Active' : 'None'}</div>
      </div>
    `;
  }

  _renderConcierge(agents) {
    const router = agents.find(a => a.is_router);
    const section = document.getElementById('concierge-section');
    if (!section || !router) return;

    section.style.display = '';
    section.innerHTML = `
      <div class="concierge-card glass-card stagger-item">
        <div class="concierge-card-accent"></div>
        <div class="concierge-card-body">
          <div class="concierge-header">
            <div class="concierge-icon">${ICONS.concierge}</div>
            <div>
              <h3 class="concierge-name">${escapeHtml(router.name)}</h3>
              <p class="concierge-title">${escapeHtml(router.title || 'Concierge Router')}</p>
            </div>
            <span class="badge badge-domain-concierge" style="margin-left:auto">Router</span>
          </div>
          <p class="concierge-desc">${escapeHtml(router.description || 'Routes queries to the appropriate department agent.')}</p>
          <div class="concierge-meta">
            <span class="badge badge-online">${router.status}</span>
            <span style="color:var(--text-muted);font-size:var(--font-size-xs)">Routes to ${agents.filter(a => !a.is_router).length} department agents</span>
          </div>
        </div>
      </div>
    `;
  }

  _renderGrid(agents) {
    const grid = document.getElementById('agents-grid');
    if (!grid) return;

    const departmentAgents = agents.filter(a => !a.is_router);

    if (departmentAgents.length === 0) {
      grid.innerHTML = '<div class="empty-state"><p class="empty-state-title">No department agents</p><p class="empty-state-desc">Create agents to handle specific departments.</p></div>';
      return;
    }

    grid.innerHTML = '';

    departmentAgents.forEach((agent, i) => {
      const card = document.createElement('div');
      card.className = 'agent-card glass-card card-accent-top stagger-item';
      card.dataset.id = agent.id;

      const domain = agent.domain || 'General';
      const domainStyle = DOMAIN_COLORS[domain] || DOMAIN_COLORS.General;
      card.style.setProperty('--card-accent', domainStyle.color);

      card.innerHTML = `
        <div class="agent-card-header">
          <div class="agent-avatar" style="background:${domainStyle.dim};color:${domainStyle.color}">
            ${(agent.name || 'A').charAt(0).toUpperCase()}
          </div>
          <div class="agent-card-info">
            <h3 class="agent-card-name">${escapeHtml(agent.name)}</h3>
            <p class="agent-card-title">${escapeHtml(agent.title || '')}</p>
          </div>
          <div class="agent-card-menu" id="agent-menu-${agent.id}"></div>
        </div>
        <div class="agent-card-domain">
          <span class="badge badge-domain-${domain.toLowerCase()}">${escapeHtml(domain)}</span>
          <span class="badge ${agent.status === 'active' ? 'badge-online' : 'badge-offline'}">${agent.status}</span>
          ${agent.hitl_mode ? `<span class="badge badge-hitl-${(agent.hitl_mode || 'auto').toLowerCase()}">${(agent.hitl_mode || 'AUTO').toUpperCase()}</span>` : ''}
        </div>
        <p class="agent-card-desc">${escapeHtml((agent.description || 'No description').slice(0, 120))}</p>
        <div class="agent-card-caps">
          ${(agent.capabilities || []).slice(0, 4).map(c => `<span class="tag tag--${domain === 'HR' ? 'purple' : domain === 'Finance' ? 'green' : domain === 'Legal' ? 'blue' : 'green'}">${escapeHtml(c)}</span>`).join('')}
        </div>
        <div class="agent-card-kb" id="agent-kb-${agent.id}" style="margin-top:var(--space-2);font-size:var(--font-size-xs);color:var(--text-muted)">
          <span class="spinner spinner--xs" style="width:10px;height:10px"></span>
        </div>
      `;

      // Add kebab dropdown menu
      const menuContainer = card.querySelector(`#agent-menu-${agent.id}`);
      if (menuContainer) {
        const dropdown = createDropdown({
          items: [
            { label: 'Edit Agent', icon: ICONS.edit, onClick: () => this._showEditDialog(agent) },
            { label: 'Knowledge Base', icon: ICONS.book, onClick: () => this._showKnowledgeSheet(agent) },
            { label: 'Test Query', icon: ICONS.test, onClick: () => this._showTestDialog(agent) },
            { divider: true },
            { label: agent.status === 'active' ? 'Disable' : 'Enable', icon: ICONS.toggle, onClick: () => this._toggleAgent(agent.id, agent.status === 'active' ? 'disable' : 'enable') },
            { divider: true },
            { label: 'Delete', icon: ICONS.trash, danger: true, onClick: () => this._deleteAgent(agent.id) },
          ]
        });
        menuContainer.appendChild(dropdown);
      }

      grid.appendChild(card);

      // Async load KB stats for this agent
      this._loadAgentKBBadge(agent.id);
    });
  }

  async _loadAgentKBBadge(agentId) {
    const el = document.getElementById(`agent-kb-${agentId}`);
    if (!el) return;
    try {
      const stats = await this.api._get(`/api/agents/${agentId}/kb/stats`);
      const docCount = stats.documentCount || 0;
      const srcCount = stats.webSourceCount || 0;
      const sizeKB = stats.totalSizeBytes ? (stats.totalSizeBytes / 1024).toFixed(1) : '0';
      const color = docCount === 0 ? 'var(--accent-red)' : docCount < 3 ? 'var(--accent-yellow)' : 'var(--accent-green)';
      el.innerHTML = `<span style="color:${color}">&#9679;</span> KB: ${docCount} docs, ${srcCount} sources (${sizeKB}KB)`;
    } catch {
      el.innerHTML = '<span style="color:var(--text-muted)">KB: --</span>';
    }
  }

  _showCreateDialog() {
    this._showAgentForm(null, 'Create New Agent');
  }

  _showEditDialog(agent) {
    this._showAgentForm(agent, `Edit: ${agent.name}`);
  }

  _showAgentForm(agent, title) {
    const isEdit = !!agent;
    let activeTabId = 'basic';

    const tabContent = {
      basic: `
        <div class="form-group">
          <label class="input-label">Name *</label>
          <input type="text" class="input" id="agent-name" value="${escapeHtml(agent?.name || '')}" placeholder="e.g. Legal Advisor" />
        </div>
        <div class="form-group">
          <label class="input-label">Title</label>
          <input type="text" class="input" id="agent-title" value="${escapeHtml(agent?.title || '')}" placeholder="e.g. Contract Review Specialist" />
        </div>
        <div class="form-group">
          <label class="input-label">Domain</label>
          <select class="select" id="agent-domain">
            ${['General','Legal','Finance','HR','Comms','DevOps','Research','Health'].map(d =>
              `<option value="${d}" ${(agent?.domain || 'General') === d ? 'selected' : ''}>${d}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="input-label">Description</label>
          <textarea class="textarea" id="agent-description" rows="3" placeholder="What does this agent do?">${escapeHtml(agent?.description || '')}</textarea>
        </div>
        <div class="form-group">
          <label class="input-label">Capabilities (comma-separated)</label>
          <input type="text" class="input" id="agent-capabilities" value="${escapeHtml((agent?.capabilities || []).join(', '))}" placeholder="contract review, compliance check" />
        </div>
        <div class="form-group">
          <label class="input-label">HITL Mode</label>
          <select class="select" id="agent-hitl">
            ${HITL_MODES.map(m => `<option value="${m}" ${(agent?.hitl_mode || 'AUTO').toUpperCase() === m ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
        </div>
      `,
      prompt: `
        <div class="form-group">
          <label class="input-label">System Prompt</label>
          <textarea class="textarea" id="agent-prompt" rows="12" placeholder="You are a specialist agent that...">${escapeHtml(agent?.system_prompt || '')}</textarea>
          <p style="font-size:var(--font-size-xs);color:var(--text-muted);margin-top:var(--space-2)">Define the agent's personality, expertise, and behavior guidelines.</p>
        </div>
      `,
      guardrails: `
        <div class="form-group">
          <label class="input-label">Guardrails (one per line)</label>
          <textarea class="textarea" id="agent-guardrails" rows="8" placeholder="no_pii_disclosure&#10;require_source_citation&#10;max_response_length_500">${escapeHtml((agent?.guardrails || []).join('\n'))}</textarea>
          <p style="font-size:var(--font-size-xs);color:var(--text-muted);margin-top:var(--space-2)">Safety rules that constrain agent behavior.</p>
        </div>
      `,
    };

    const tabsComponent = createTabs({
      tabs: [
        { id: 'basic', label: 'Basic Info' },
        { id: 'prompt', label: 'System Prompt' },
        { id: 'guardrails', label: 'Guardrails' },
      ],
      activeTab: 'basic',
      onTabChange: (id) => {
        activeTabId = id;
        const body = document.getElementById('agent-form-content');
        if (body) body.innerHTML = tabContent[id];
      }
    });

    const body = `
      <div id="agent-form-tabs"></div>
      <div id="agent-form-content">${tabContent.basic}</div>
    `;

    const self = this;
    showModal({
      title,
      body,
      size: 'lg',
      actions: [
        {
          label: isEdit ? 'Save Changes' : 'Create Agent',
          class: 'btn btn-primary',
          onClick: async () => {
            const data = {
              name: document.getElementById('agent-name')?.value || '',
              title: document.getElementById('agent-title')?.value || '',
              domain: document.getElementById('agent-domain')?.value || 'General',
              description: document.getElementById('agent-description')?.value || '',
              capabilities: (document.getElementById('agent-capabilities')?.value || '').split(',').map(s => s.trim()).filter(Boolean),
              system_prompt: document.getElementById('agent-prompt')?.value || agent?.system_prompt || '',
              hitl_mode: document.getElementById('agent-hitl')?.value || 'AUTO',
              guardrails: (document.getElementById('agent-guardrails')?.value || '').split('\n').map(s => s.trim()).filter(Boolean),
            };

            if (!data.name) { showToast('Name is required', 'error'); return; }

            try {
              if (isEdit) {
                await self.api._put(`/api/agents/${agent.id}`, data);
                showToast('Agent updated', 'success');
              } else {
                await self.api._post('/api/agents', data);
                showToast('Agent created', 'success');
              }
              hideModal();
              self._fetchAgents();
            } catch (err) {
              showToast(`Failed: ${err.message}`, 'error');
            }
          },
        },
        { label: 'Cancel', class: 'btn btn-ghost', onClick: () => hideModal() },
      ],
    });

    // Inject tabs component
    setTimeout(() => {
      const tabsContainer = document.getElementById('agent-form-tabs');
      if (tabsContainer) tabsContainer.appendChild(tabsComponent.el);
    }, 50);
  }

  _showTestDialog(agent) {
    const body = `
      <div class="form-group">
        <label class="input-label">Test Query</label>
        <input type="text" class="input" id="test-query-input" placeholder="Type a test query..." />
      </div>
      <div id="test-output" style="margin-top:var(--space-4)"></div>
    `;

    const self = this;
    showModal({
      title: `Test: ${agent.name}`,
      body,
      actions: [
        {
          label: 'Run Query',
          class: 'btn btn-primary',
          onClick: async () => {
            const query = document.getElementById('test-query-input')?.value.trim();
            const output = document.getElementById('test-output');
            if (!query || !output) return;
            output.innerHTML = '<div class="spinner spinner--sm" style="margin:var(--space-4) auto"></div>';
            try {
              const result = await self.api._post(`/api/agents/${agent.id}/query`, { query });
              output.innerHTML = `<pre class="code-block" style="max-height:300px;overflow:auto">${escapeHtml(JSON.stringify(result, null, 2))}</pre>`;
            } catch (err) {
              output.innerHTML = `<div class="badge badge-offline">${escapeHtml(err.message)}</div>`;
            }
          }
        },
        { label: 'Close', class: 'btn btn-ghost', onClick: () => hideModal() },
      ],
    });
  }

  _showKnowledgeSheet(agent) {
    const container = document.getElementById('knowledge-sheet-container');
    if (!container) return;

    container.innerHTML = `
      <div class="sheet-backdrop" id="knowledge-backdrop"></div>
      <div class="sheet" id="knowledge-sheet">
        <div class="sheet-header">
          <h3 class="sheet-title">Knowledge Base: ${escapeHtml(agent.name)}</h3>
          <button class="btn btn-sm btn-ghost" id="close-knowledge-sheet">&times;</button>
        </div>
        <div class="sheet-body">
          <div id="knowledge-tabs-container"></div>
          <div id="knowledge-tab-content">
            <div id="knowledge-docs-tab">
              <div style="margin-bottom:var(--space-4)">
                <label class="btn btn-sm btn-outline" style="cursor:pointer">
                  Upload Document
                  <input type="file" id="knowledge-upload" accept=".txt,.md,.pdf,.json,.csv" style="display:none;" />
                </label>
              </div>
              <div id="knowledge-list"><div class="spinner spinner--sm"></div></div>
            </div>
            <div id="knowledge-web-tab" style="display:none">
              <div class="form-group">
                <label class="input-label">Add Web Source URL</label>
                <div class="input-group">
                  <input type="url" class="input" id="web-source-url" placeholder="https://example.com/docs" />
                  <button class="btn btn-sm btn-primary" id="add-web-source">Add</button>
                </div>
              </div>
              <div id="web-sources-list" style="margin-top:var(--space-4)">
                <p style="color:var(--text-muted);font-size:var(--font-size-sm)">No web sources configured.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Tabs
    const tabsComp = createTabs({
      tabs: [{ id: 'docs', label: 'Documents' }, { id: 'web', label: 'Web Sources' }],
      activeTab: 'docs',
      onTabChange: (id) => {
        document.getElementById('knowledge-docs-tab').style.display = id === 'docs' ? '' : 'none';
        document.getElementById('knowledge-web-tab').style.display = id === 'web' ? '' : 'none';
      }
    });
    const tabsContainer = document.getElementById('knowledge-tabs-container');
    if (tabsContainer) tabsContainer.appendChild(tabsComp.el);

    // Close handlers
    const close = () => { container.innerHTML = ''; };
    document.getElementById('close-knowledge-sheet')?.addEventListener('click', close);
    document.getElementById('knowledge-backdrop')?.addEventListener('click', close);

    // Load documents and web sources
    this._loadKnowledgeDocs(agent.id);
    this._loadWebSources(agent.id);

    // Add web source handler
    const addWebBtn = document.getElementById('add-web-source');
    const webUrlInput = document.getElementById('web-source-url');
    if (addWebBtn && webUrlInput) {
      addWebBtn.addEventListener('click', async () => {
        const url = webUrlInput.value.trim();
        if (!url) { showToast('Enter a URL', 'error'); return; }
        try {
          await this.api._post(`/api/agents/${agent.id}/sources`, { url, name: new URL(url).hostname });
          showToast('Web source added', 'success');
          webUrlInput.value = '';
          this._loadWebSources(agent.id);
        } catch (err) { showToast(`Failed: ${err.message}`, 'error'); }
      });
    }

    // Upload handler
    const uploadInput = document.getElementById('knowledge-upload');
    if (uploadInput) {
      uploadInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const text = await file.text();
          await this.api._post(`/api/agents/${agent.id}/knowledge`, {
            filename: file.name,
            file_type: file.name.split('.').pop(),
            file_size: file.size,
            content: text,
          });
          try { await this.api._post(`/api/rag/index/${agent.id}`, { documentId: file.name, content: text, metadata: { filename: file.name } }); } catch {}
          showToast(`Uploaded: ${file.name}`, 'success');
          this._loadKnowledgeDocs(agent.id);
        } catch (err) {
          showToast(`Upload failed: ${err.message}`, 'error');
        }
        uploadInput.value = '';
      });
    }
  }

  async _loadKnowledgeDocs(agentId) {
    const container = document.getElementById('knowledge-list');
    if (!container) return;
    try {
      const docs = await this.api._get(`/api/agents/${agentId}/knowledge`);
      if (!docs || docs.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);font-size:var(--font-size-sm)">No documents uploaded. Drag files or click Upload.</p>';
        return;
      }
      container.innerHTML = docs.map(doc => `
        <div class="knowledge-doc-item" data-doc-id="${escapeHtml(doc.id)}">
          <div class="knowledge-doc-info">
            <span class="knowledge-doc-name">${escapeHtml(doc.filename || doc.id)}</span>
            <span class="knowledge-doc-meta">${doc.file_type || 'txt'} ${doc.file_size ? `- ${(doc.file_size / 1024).toFixed(1)}KB` : ''}${doc.chunk_count ? ` - ${doc.chunk_count} chunks` : ''}${doc.added_by && doc.added_by !== 'user' ? ` - via ${doc.added_by}` : ''}</span>
          </div>
          <div style="display:flex;gap:4px;align-items:center">
            <span class="badge" style="font-size:10px;padding:2px 6px" title="Priority: ${doc.priority || 50}">P${doc.priority || 50}</span>
            <button class="btn btn-sm btn-ghost knowledge-edit-btn" data-doc-id="${escapeHtml(doc.id)}" title="Edit">&#9998;</button>
            <button class="btn btn-sm btn-ghost knowledge-archive-btn" data-doc-id="${escapeHtml(doc.id)}" title="Archive" style="color:var(--accent-yellow)">&#128451;</button>
            <button class="btn btn-sm btn-ghost knowledge-delete-btn" data-doc-id="${escapeHtml(doc.id)}" style="color:var(--accent-red)" title="Delete">&times;</button>
          </div>
        </div>
      `).join('');
      // Delete buttons
      container.querySelectorAll('.knowledge-delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Permanently delete this document?')) return;
          try {
            await this.api._delete(`/api/agents/${agentId}/knowledge/${btn.dataset.docId}`);
            showToast('Document removed', 'success');
            this._loadKnowledgeDocs(agentId);
          } catch (err) { showToast(`Delete failed: ${err.message}`, 'error'); }
        });
      });
      // Archive (soft-delete) buttons
      container.querySelectorAll('.knowledge-archive-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await this.api._post(`/api/agents/${agentId}/knowledge/${btn.dataset.docId}/archive`);
            showToast('Document archived', 'success');
            this._loadKnowledgeDocs(agentId);
          } catch (err) { showToast(`Archive failed: ${err.message}`, 'error'); }
        });
      });
      // Inline edit buttons
      container.querySelectorAll('.knowledge-edit-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const docId = btn.dataset.docId;
          try {
            const doc = await this.api._get(`/api/agents/${agentId}/knowledge/${docId}`);
            this._showEditDocDialog(agentId, doc);
          } catch (err) { showToast(`Failed to load: ${err.message}`, 'error'); }
        });
      });
    } catch {
      container.innerHTML = '<p style="color:var(--text-muted);font-size:var(--font-size-sm)">Could not load documents.</p>';
    }
  }

  async _loadWebSources(agentId) {
    const container = document.getElementById('web-sources-list');
    if (!container) return;
    try {
      const sources = await this.api._get(`/api/agents/${agentId}/sources`);
      if (!sources || sources.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);font-size:var(--font-size-sm)">No web sources configured.</p>';
        return;
      }
      container.innerHTML = sources.map(src => `
        <div class="knowledge-doc-item">
          <div class="knowledge-doc-info">
            <span class="knowledge-doc-name">${escapeHtml(src.name || src.url)}</span>
            <span class="knowledge-doc-meta">${escapeHtml(src.url)} ${src.auto_refresh ? '(auto-refresh)' : ''}</span>
          </div>
          <button class="btn btn-sm btn-ghost web-source-delete-btn" data-source-id="${escapeHtml(src.id)}" style="color:var(--accent-red)">&times;</button>
        </div>
      `).join('');
      container.querySelectorAll('.web-source-delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await this.api._delete(`/api/agents/${agentId}/sources/${btn.dataset.sourceId}`);
            showToast('Web source removed', 'success');
            this._loadWebSources(agentId);
          } catch (err) { showToast(`Delete failed: ${err.message}`, 'error'); }
        });
      });
    } catch {
      container.innerHTML = '<p style="color:var(--text-muted);font-size:var(--font-size-sm)">Could not load web sources.</p>';
    }
  }

  _showEditDocDialog(agentId, doc) {
    const body = `
      <div class="form-group">
        <label class="input-label">Filename</label>
        <input type="text" class="input" id="edit-doc-filename" value="${escapeHtml(doc.filename || '')}" />
      </div>
      <div class="form-group">
        <label class="input-label">Priority (0-100)</label>
        <input type="number" class="input" id="edit-doc-priority" min="0" max="100" value="${doc.priority || 50}" />
      </div>
      <div class="form-group">
        <label class="input-label">Language</label>
        <input type="text" class="input" id="edit-doc-language" value="${escapeHtml(doc.language || '')}" placeholder="e.g. en, es, fr" />
      </div>
    `;

    const self = this;
    showModal({
      title: `Edit: ${doc.filename}`,
      body,
      actions: [
        {
          label: 'Save',
          class: 'btn btn-primary',
          onClick: async () => {
            try {
              await self.api._put(`/api/agents/${agentId}/knowledge/${doc.id}`, {
                filename: document.getElementById('edit-doc-filename')?.value || doc.filename,
                priority: parseInt(document.getElementById('edit-doc-priority')?.value, 10) || 50,
                language: document.getElementById('edit-doc-language')?.value || null,
              });
              showToast('Document updated', 'success');
              hideModal();
              self._loadKnowledgeDocs(agentId);
            } catch (err) { showToast(`Update failed: ${err.message}`, 'error'); }
          },
        },
        { label: 'Cancel', class: 'btn btn-ghost', onClick: () => hideModal() },
      ],
    });
  }

  async _toggleAgent(id, action) {
    try {
      await this.api._post(`/api/agents/${id}/${action}`, {});
      showToast(`Agent ${action}d`, 'success');
      this._fetchAgents();
    } catch (err) { showToast(`Failed: ${err.message}`, 'error'); }
  }

  async _deleteAgent(id) {
    if (!confirm('Delete this agent? This cannot be undone.')) return;
    try {
      await this.api._delete(`/api/agents/${id}`);
      showToast('Agent deleted', 'success');
      this._fetchAgents();
    } catch (err) { showToast(`Failed: ${err.message}`, 'error'); }
  }

  _cleanup() {
    this._unsubs.forEach(fn => fn());
    this._unsubs = [];
  }
}
