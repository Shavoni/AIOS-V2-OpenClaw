/**
 * AIOS V2 - Skills Page (V1-Level Polish)
 * Gradient header, stat cards, search/filter toolbar, category chips,
 * enhanced skill cards with accent bars and stagger animations,
 * rich detail panel with execution form and styled output.
 */

import { renderMarkdown } from '../components/markdown.js';
import { showToast } from '../components/toast.js';
import { escapeHtml, $ } from '../utils.js';

/* ── Category color map ─────────────────────────────────────────────────── */

const CATEGORY_COLORS = {
  devops:      { color: 'var(--accent-green)',  dim: 'var(--accent-green-dim)',  border: 'var(--accent-green-border)',  gradient: 'linear-gradient(135deg, #00ff88, #00cc6a)', iconClass: 'skill-card-icon--devops' },
  ai:          { color: 'var(--accent-purple)', dim: 'var(--accent-purple-dim)', border: 'var(--accent-purple-border)', gradient: 'linear-gradient(135deg, #7b2ff7, #5a1db8)', iconClass: 'skill-card-icon--ai' },
  automation:  { color: 'var(--accent-blue)',   dim: 'var(--accent-blue-dim)',   border: 'var(--accent-blue-border)',   gradient: 'linear-gradient(135deg, #00b4d8, #0088a8)', iconClass: 'skill-card-icon--infra' },
  business:    { color: 'var(--accent-orange)', dim: 'var(--accent-orange-dim)', border: 'var(--accent-orange-border)', gradient: 'linear-gradient(135deg, #ff9f43, #d97706)', iconClass: 'skill-card-icon--business' },
  research:    { color: 'var(--accent-red)',    dim: 'var(--accent-red-dim)',    border: 'var(--accent-red-border)',    gradient: 'linear-gradient(135deg, #ff6b6b, #e11d48)', iconClass: 'skill-card-icon--research' },
  infra:       { color: 'var(--accent-blue)',   dim: 'var(--accent-blue-dim)',   border: 'var(--accent-blue-border)',   gradient: 'linear-gradient(135deg, #06b6d4, #0891b2)', iconClass: 'skill-card-icon--infra' },
  development: { color: 'var(--accent-green)',  dim: 'var(--accent-green-dim)',  border: 'var(--accent-green-border)',  gradient: 'linear-gradient(135deg, #22c55e, #16a34a)', iconClass: 'skill-card-icon--devops' },
  data:        { color: 'var(--accent-blue)',   dim: 'var(--accent-blue-dim)',   border: 'var(--accent-blue-border)',   gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)', iconClass: 'skill-card-icon--infra' },
  general:     { color: 'var(--text-secondary)', dim: 'var(--bg-surface)',       border: 'var(--border-default)',       gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)', iconClass: '' },
};

/* ── Inline SVG icons ───────────────────────────────────────────────────── */

const ICONS = {
  skills: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`,
  search: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="7" r="5"/><path d="M11 11l3.5 3.5"/></svg>`,
  run:    `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="4,2 12,7 4,12" fill="currentColor"/></svg>`,
  close:  `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4l8 8M12 4l-8 8"/></svg>`,
  code:   `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="4,3 1,7 4,11"/><polyline points="10,3 13,7 10,11"/><line x1="8" y1="2" x2="6" y2="12"/></svg>`,
  info:   `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="7" r="6"/><line x1="7" y1="6" x2="7" y2="10"/><circle cx="7" cy="4" r="0.5" fill="currentColor"/></svg>`,
  arrow:  `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4.5 2.5l4 3.5-4 3.5"/></svg>`,
};

/* ── Helper: resolve category from skill ────────────────────────────────── */

function resolveCategory(skill) {
  if (skill.category) return skill.category;
  const name = (skill.name || skill.id || '').toLowerCase();
  const desc = (skill.description || '').toLowerCase();
  const combined = name + ' ' + desc;
  if (/deploy|docker|ci|cd|pipeline|devops|kubernetes|k8s/.test(combined)) return 'devops';
  if (/ai|ml|model|llm|gpt|neural|train|inference/.test(combined)) return 'ai';
  if (/automat|workflow|cron|schedule|trigger/.test(combined)) return 'automation';
  if (/business|report|analytics|sales|crm|finance/.test(combined)) return 'business';
  if (/research|paper|study|experiment|analysis/.test(combined)) return 'research';
  if (/infra|server|monitor|cloud|aws|azure/.test(combined)) return 'infra';
  if (/dev|code|build|compile|test|debug|api/.test(combined)) return 'development';
  if (/data|database|sql|csv|etl|pipeline/.test(combined)) return 'data';
  return 'general';
}

function getCategoryStyle(category) {
  return CATEGORY_COLORS[(category || 'general').toLowerCase()] || CATEGORY_COLORS.general;
}

/* ══════════════════════════════════════════════════════════════════════════
   Skills Page Class
   ══════════════════════════════════════════════════════════════════════════ */

export class SkillsPage {
  /**
   * @param {Object} app - App instance with state, api, router
   */
  constructor(app) {
    this.state = app.state;
    this.api = app.api;
    this.router = app.router;
    this._unsubs = [];
    this._expandedSkill = null;
    this._skills = [];
    this._searchQuery = '';
    this._activeCategory = 'all';
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  render(mount) {
    mount.innerHTML = `
      <div class="page page-skills">

        <!-- Gradient Header -->
        <div class="page-gradient-header" style="background: var(--gradient-skills)">
          <div class="page-header-content">
            <h1 class="page-title">
              <span class="page-title-icon">${ICONS.skills}</span>
              Skills &amp; Capabilities
            </h1>
            <p class="page-subtitle">Installed skill modules, automation tools, and extensible capabilities</p>
            <div class="page-header-actions">
              <span class="badge" id="skills-count-badge"
                    style="background:rgba(255,255,255,0.2);color:#fff;font-size:var(--font-size-sm);padding:0.3rem 0.8rem">
                0 skills
              </span>
            </div>
          </div>
        </div>

        <!-- Stats Row -->
        <section class="stat-grid" id="skills-stats" style="margin-bottom:var(--space-8)"></section>

        <!-- Search / Filter Toolbar -->
        <div class="skills-toolbar" id="skills-toolbar">
          <div class="skills-search" style="position:relative">
            <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-muted);pointer-events:none">${ICONS.search}</span>
            <input type="text" class="input" id="skills-search-input"
                   placeholder="Search skills by name or description..."
                   style="padding-left:36px" />
          </div>
          <div class="skills-filter-chips" id="skills-filter-chips"></div>
        </div>

        <!-- Skills Grid -->
        <div class="skills-grid" id="skills-grid">
          <div class="loader-overlay" style="min-height:200px">
            <div class="spinner"></div>
            <span style="color:var(--text-secondary)">Loading skills...</span>
          </div>
        </div>

        <!-- Detail Panel (hidden) -->
        <div class="skill-detail" id="skill-detail-panel" style="display:none">
          <div class="skill-detail-header">
            <div class="skill-detail-icon" id="skill-detail-icon"></div>
            <div class="skill-detail-info">
              <h2 class="skill-detail-name" id="skill-detail-title"></h2>
              <p class="skill-detail-desc" id="skill-detail-subtitle"></p>
            </div>
            <div class="skill-detail-actions">
              <button class="btn btn-sm btn-ghost" id="skill-detail-close"
                      style="font-size:var(--font-size-lg);line-height:1">${ICONS.close}</button>
            </div>
          </div>
          <div class="skill-detail-content" id="skill-detail-body">
          </div>
        </div>

      </div>
    `;

    // --- Bind events ---
    this._bindEvents(mount);

    // --- Subscribe to state ---
    const unsubSkills = this.state.on('skills', (skills) => {
      this._skills = skills || [];
      this._onSkillsUpdated();
    });
    this._unsubs.push(unsubSkills);

    // --- Fetch ---
    this._fetchSkills();

    return () => this._cleanup();
  }

  /* ── Bind Events ─────────────────────────────────────────────────────── */

  _bindEvents(mount) {
    // Search input
    const searchInput = $('#skills-search-input', mount);
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this._searchQuery = e.target.value.trim().toLowerCase();
        this._renderGrid(this._getFilteredSkills());
      });
    }

    // Close detail panel
    const closeBtn = $('#skill-detail-close', mount);
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this._closeDetail());
    }
  }

  /* ── Fetch Skills ────────────────────────────────────────────────────── */

  async _fetchSkills() {
    try {
      await this.api.fetchSkills();
    } catch (err) {
      const grid = document.getElementById('skills-grid');
      if (grid) {
        grid.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">${ICONS.skills}</div>
            <p class="empty-state-title">Failed to load skills</p>
            <p class="empty-state-desc">${escapeHtml(err.message)}</p>
            <button class="btn btn-sm btn-primary" id="skills-retry" style="margin-top:var(--space-4)">Retry</button>
          </div>
        `;
        const retryBtn = $('#skills-retry');
        if (retryBtn) retryBtn.addEventListener('click', () => this._fetchSkills());
      }
    }
  }

  /* ── On skills data updated ──────────────────────────────────────────── */

  _onSkillsUpdated() {
    this._renderCountBadge();
    this._renderStats();
    this._renderFilterChips();
    this._renderGrid(this._getFilteredSkills());
  }

  /* ── Count Badge ─────────────────────────────────────────────────────── */

  _renderCountBadge() {
    const badge = document.getElementById('skills-count-badge');
    if (badge) {
      badge.textContent = `${this._skills.length} skill${this._skills.length !== 1 ? 's' : ''}`;
    }
  }

  /* ── Stats Row ───────────────────────────────────────────────────────── */

  _renderStats() {
    const container = document.getElementById('skills-stats');
    if (!container) return;

    const total = this._skills.length;
    const active = this._skills.filter(s => s.status === 'active' || s.enabled !== false).length;
    const categories = new Set(this._skills.map(s => resolveCategory(s))).size;

    container.innerHTML = `
      <div class="stat-card glass-card stagger-item">
        <div class="stat-label">Total Skills</div>
        <div class="stat-value stat-value--orange">${total}</div>
      </div>
      <div class="stat-card glass-card stagger-item">
        <div class="stat-label">Active Skills</div>
        <div class="stat-value stat-value--green">${active}</div>
      </div>
      <div class="stat-card glass-card stagger-item">
        <div class="stat-label">Categories</div>
        <div class="stat-value stat-value--blue">${categories}</div>
      </div>
    `;
  }

  /* ── Filter Chips ────────────────────────────────────────────────────── */

  _renderFilterChips() {
    const container = document.getElementById('skills-filter-chips');
    if (!container) return;

    const categories = [...new Set(this._skills.map(s => resolveCategory(s)))].sort();

    let html = `<button class="skills-filter-chip ${this._activeCategory === 'all' ? 'active' : ''}" data-category="all">All</button>`;
    categories.forEach(cat => {
      const label = cat.charAt(0).toUpperCase() + cat.slice(1);
      html += `<button class="skills-filter-chip ${this._activeCategory === cat ? 'active' : ''}" data-category="${escapeHtml(cat)}">${escapeHtml(label)}</button>`;
    });

    container.innerHTML = html;

    // Bind chip clicks
    container.querySelectorAll('.skills-filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this._activeCategory = chip.dataset.category;
        // Update active state
        container.querySelectorAll('.skills-filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this._renderGrid(this._getFilteredSkills());
      });
    });
  }

  /* ── Filtered skills helper ──────────────────────────────────────────── */

  _getFilteredSkills() {
    let filtered = [...this._skills];

    // Category filter
    if (this._activeCategory !== 'all') {
      filtered = filtered.filter(s => resolveCategory(s) === this._activeCategory);
    }

    // Search filter
    if (this._searchQuery) {
      filtered = filtered.filter(s => {
        const name = (s.name || s.id || '').toLowerCase();
        const desc = (s.description || '').toLowerCase();
        return name.includes(this._searchQuery) || desc.includes(this._searchQuery);
      });
    }

    return filtered;
  }

  /* ── Render Grid ─────────────────────────────────────────────────────── */

  _renderGrid(skills) {
    const grid = document.getElementById('skills-grid');
    if (!grid) return;

    if (!skills || skills.length === 0) {
      const isFiltered = this._searchQuery || this._activeCategory !== 'all';
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-state-icon">${ICONS.skills}</div>
          <p class="empty-state-title">${isFiltered ? 'No matching skills' : 'No skills installed'}</p>
          <p class="empty-state-desc">${isFiltered ? 'Try adjusting your search or filter criteria.' : 'Skills will appear here once they are installed.'}</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = '';

    skills.forEach((skill) => {
      const id = skill.id || skill.name;
      const category = resolveCategory(skill);
      const catStyle = getCategoryStyle(category);
      const catLabel = category.charAt(0).toUpperCase() + category.slice(1);
      const isActive = skill.status === 'active' || skill.enabled !== false;
      const emoji = skill.emoji || skill.icon || '';

      const card = document.createElement('div');
      card.className = 'skill-card glass-card card-accent-top stagger-item';
      card.dataset.skillId = id;
      card.style.setProperty('--card-accent', catStyle.color);
      // Override the accent bar color via inline style on the pseudo-element
      card.style.cssText += `; position:relative; overflow:hidden;`;

      card.innerHTML = `
        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${catStyle.gradient}"></div>
        <div class="skill-card-header">
          <div class="skill-card-icon ${catStyle.iconClass}"
               style="width:48px;height:48px;font-size:1.5rem;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;background:${catStyle.dim};color:${catStyle.color}">
            ${emoji ? `<span style="font-size:1.4rem">${emoji}</span>` : ICONS.code}
          </div>
          <div class="skill-card-meta">
            <h3 class="skill-card-name">${escapeHtml(skill.name || skill.id)}</h3>
            <span class="skill-card-source">
              <span class="badge" style="background:${catStyle.dim};color:${catStyle.color};font-size:var(--font-size-xs);padding:0.1rem 0.4rem">${escapeHtml(catLabel)}</span>
            </span>
          </div>
        </div>
        <p class="skill-card-desc">${escapeHtml(skill.description || 'No description available')}</p>
        <div class="skill-card-footer">
          ${skill.version ? `<span class="skill-card-version">${escapeHtml(skill.version)}</span>` : '<span></span>'}
          <span class="skill-card-status">
            <span class="pulse-dot${isActive ? '' : ' pulse-dot--red'}" style="width:6px;height:6px"></span>
            ${isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      `;

      card.addEventListener('click', () => this._showDetail(id));
      grid.appendChild(card);
    });
  }

  /* ── Show Detail Panel ───────────────────────────────────────────────── */

  async _showDetail(id) {
    const panel = document.getElementById('skill-detail-panel');
    const titleEl = document.getElementById('skill-detail-title');
    const subtitleEl = document.getElementById('skill-detail-subtitle');
    const iconEl = document.getElementById('skill-detail-icon');
    const bodyEl = document.getElementById('skill-detail-body');

    if (!panel || !bodyEl) return;

    this._expandedSkill = id;

    // Find skill in local data for quick header render
    const skillSummary = this._skills.find(s => (s.id || s.name) === id);
    const category = skillSummary ? resolveCategory(skillSummary) : 'general';
    const catStyle = getCategoryStyle(category);
    const emoji = skillSummary?.emoji || skillSummary?.icon || '';

    // Populate header immediately
    if (titleEl) titleEl.textContent = skillSummary?.name || id;
    if (subtitleEl) subtitleEl.textContent = skillSummary?.description || '';
    if (iconEl) {
      iconEl.style.background = catStyle.dim;
      iconEl.style.color = catStyle.color;
      iconEl.innerHTML = emoji ? `<span style="font-size:1.5rem">${emoji}</span>` : ICONS.skills;
    }

    // Show panel with animation
    panel.style.display = '';
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Loading state for body
    bodyEl.innerHTML = `
      <div class="loader-overlay" style="min-height:120px">
        <div class="spinner spinner--sm"></div>
        <span style="color:var(--text-secondary);font-size:var(--font-size-sm)">Loading skill details...</span>
      </div>
    `;

    try {
      const detail = await this.api.fetchSkillDetail(id);
      this._renderDetailBody(id, detail, skillSummary, category, catStyle);
    } catch (err) {
      bodyEl.innerHTML = `
        <div style="padding:var(--space-4)">
          <div class="badge badge-offline" style="margin-bottom:var(--space-3)">Error</div>
          <p style="color:var(--text-secondary)">${escapeHtml(err.message)}</p>
        </div>
      `;
    }
  }

  /* ── Render Detail Body ──────────────────────────────────────────────── */

  _renderDetailBody(id, detail, skillSummary, category, catStyle) {
    const bodyEl = document.getElementById('skill-detail-body');
    if (!bodyEl) return;

    const catLabel = category.charAt(0).toUpperCase() + category.slice(1);
    const isActive = skillSummary ? (skillSummary.status === 'active' || skillSummary.enabled !== false) : true;

    let html = '';

    // --- Metadata badges row ---
    html += `
      <div style="display:flex;flex-wrap:wrap;gap:var(--space-2);margin-bottom:var(--space-5)">
        <span class="badge" style="background:${catStyle.dim};color:${catStyle.color}">${escapeHtml(catLabel)}</span>
        <span class="badge ${isActive ? 'badge-online' : 'badge-offline'}">${isActive ? 'Active' : 'Inactive'}</span>
        ${detail.version ? `<span class="badge badge-info">v${escapeHtml(detail.version)}</span>` : ''}
        ${detail.author ? `<span class="badge badge-purple">${escapeHtml(detail.author)}</span>` : ''}
      </div>
    `;

    // --- SKILL.md / README content ---
    const readmeContent = detail.readme || detail.skillMd || detail.content;
    if (readmeContent) {
      html += `
        <div class="skill-readme" style="margin-bottom:var(--space-6)">
          ${renderMarkdown(readmeContent)}
        </div>
      `;
    }

    // --- Available Commands ---
    const scripts = detail.scripts || detail.commands || [];
    if (scripts.length) {
      html += `
        <div style="margin-bottom:var(--space-6)">
          <h3 style="font-size:var(--font-size-md);font-weight:var(--font-weight-semibold);color:var(--text-white);margin-bottom:var(--space-3);display:flex;align-items:center;gap:var(--space-2)">
            ${ICONS.code} Available Commands
          </h3>
          <div style="display:flex;flex-wrap:wrap;gap:var(--space-2)">
            ${scripts.map(s => {
              const cmdName = typeof s === 'string' ? s : (s.name || s.command);
              return `<span class="tag tag--green" style="cursor:pointer" data-cmd="${escapeHtml(cmdName)}">${ICONS.arrow} ${escapeHtml(cmdName)}</span>`;
            }).join('')}
          </div>
        </div>
      `;
    }

    // --- Execution Form ---
    if (scripts.length) {
      const firstCmd = typeof scripts[0] === 'string' ? scripts[0] : (scripts[0].name || scripts[0].command || '');
      html += `
        <div class="skill-execute" style="margin:0 0 var(--space-6) 0">
          <div class="skill-execute-header">
            <span class="skill-execute-title">${ICONS.run} Execute Command</span>
            <span class="skill-execute-status" id="skill-exec-status"></span>
          </div>
          <div style="padding:var(--space-4)">
            <div style="display:flex;gap:var(--space-3);margin-bottom:var(--space-3)">
              <div style="flex:1">
                <label class="input-label">Command</label>
                <input type="text" class="input" id="skill-exec-command"
                       value="${escapeHtml(firstCmd)}" placeholder="Command name" />
              </div>
              <div style="flex:1">
                <label class="input-label">Arguments</label>
                <input type="text" class="input" id="skill-exec-args"
                       placeholder='{"key": "value"} or plain text' />
              </div>
            </div>
            <button class="btn btn-primary btn-sm" id="skill-exec-run">
              ${ICONS.run} Run Command
            </button>
          </div>
          <div class="skill-execute-output code-block" id="skill-exec-output"
               style="display:none;margin:0 var(--space-4) var(--space-4);border-radius:var(--radius-md);background:var(--bg-primary);padding:var(--space-4);font-family:var(--font-mono);font-size:var(--font-size-sm);max-height:300px;overflow:auto;white-space:pre-wrap;word-break:break-all;color:var(--text-primary);border:1px solid var(--border-default)">
          </div>
        </div>
      `;
    }

    // --- Metadata table ---
    const metaEntries = [];
    if (detail.version) metaEntries.push(['Version', detail.version]);
    if (detail.author) metaEntries.push(['Author', detail.author]);
    if (category) metaEntries.push(['Category', catLabel]);
    if (detail.source) metaEntries.push(['Source', detail.source]);
    if (detail.license) metaEntries.push(['License', detail.license]);
    if (skillSummary?.tags?.length) metaEntries.push(['Tags', skillSummary.tags.join(', ')]);

    if (metaEntries.length > 0) {
      html += `
        <div style="margin-bottom:var(--space-4)">
          <h3 style="font-size:var(--font-size-md);font-weight:var(--font-weight-semibold);color:var(--text-white);margin-bottom:var(--space-3);display:flex;align-items:center;gap:var(--space-2)">
            ${ICONS.info} Metadata
          </h3>
          <table class="data-table">
            <tbody>
              ${metaEntries.map(([k, v]) => `
                <tr>
                  <td style="color:var(--text-muted);width:120px;font-weight:var(--font-weight-medium)">${escapeHtml(k)}</td>
                  <td>${escapeHtml(v)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    // --- No extra details fallback ---
    if (!readmeContent && scripts.length === 0 && metaEntries.length === 0) {
      html += `<p style="color:var(--text-muted);padding:var(--space-4)">No additional details available for this skill.</p>`;
    }

    bodyEl.innerHTML = html;

    // --- Bind execute button ---
    const runBtn = $('#skill-exec-run');
    if (runBtn) {
      runBtn.addEventListener('click', () => this._executeSkill(id));
    }

    // --- Bind command tags to prefill ---
    bodyEl.querySelectorAll('[data-cmd]').forEach(tag => {
      tag.addEventListener('click', () => {
        const cmdInput = document.getElementById('skill-exec-command');
        if (cmdInput) {
          cmdInput.value = tag.dataset.cmd;
          cmdInput.focus();
        }
      });
    });
  }

  /* ── Execute Skill Command ───────────────────────────────────────────── */

  async _executeSkill(id) {
    const commandInput = document.getElementById('skill-exec-command');
    const argsInput = document.getElementById('skill-exec-args');
    const outputEl = document.getElementById('skill-exec-output');
    const runBtn = document.getElementById('skill-exec-run');
    const statusEl = document.getElementById('skill-exec-status');

    if (!commandInput || !outputEl) return;

    const command = commandInput.value.trim();
    if (!command) {
      showToast('Enter a command name', 'error');
      return;
    }

    // Parse args
    let args = {};
    const argsRaw = argsInput?.value.trim();
    if (argsRaw) {
      try {
        args = JSON.parse(argsRaw);
      } catch {
        args = { input: argsRaw };
      }
    }

    // Show running state
    outputEl.style.display = 'block';
    outputEl.textContent = '';
    outputEl.innerHTML = '<span style="color:var(--accent-orange)">Executing...</span>';
    if (runBtn) runBtn.disabled = true;
    if (statusEl) {
      statusEl.className = 'skill-execute-status skill-execute-status--running';
      statusEl.innerHTML = '<span class="spinner spinner--sm"></span> Running';
    }

    try {
      const result = await this.api.executeSkill(id, command, args);
      const output = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      outputEl.textContent = output;
      if (statusEl) {
        statusEl.className = 'skill-execute-status skill-execute-status--success';
        statusEl.textContent = 'Success';
      }
      showToast('Skill executed successfully', 'success');
    } catch (err) {
      outputEl.innerHTML = `<span class="output-line output-line--error">Error: ${escapeHtml(err.message)}</span>`;
      if (statusEl) {
        statusEl.className = 'skill-execute-status skill-execute-status--error';
        statusEl.textContent = 'Failed';
      }
      showToast('Skill execution failed', 'error');
    } finally {
      if (runBtn) runBtn.disabled = false;
    }
  }

  /* ── Close Detail Panel ──────────────────────────────────────────────── */

  _closeDetail() {
    const panel = document.getElementById('skill-detail-panel');
    if (panel) panel.style.display = 'none';
    this._expandedSkill = null;
  }

  /* ── Cleanup ─────────────────────────────────────────────────────────── */

  _cleanup() {
    this._unsubs.forEach(fn => fn());
    this._unsubs = [];
    this._expandedSkill = null;
    this._skills = [];
  }
}
