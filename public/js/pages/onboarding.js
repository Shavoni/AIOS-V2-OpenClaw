/**
 * AIOS V2 - Onboarding Page (V1 Polish)
 * 8-step discovery wizard:
 *   OrgType -> Industry -> Source -> Discovering -> Select -> LinkGPTs -> Review -> Deploy
 *
 * Supports website crawl discovery with async polling, bulk agent selection,
 * compliance guardrails, GPT linking, and full deployment flow.
 */

import { createToggle } from '../components/toggle.js';
import { showToast } from '../components/toast.js';
import { escapeHtml, $ } from '../utils.js';

/* ──────────────────────────── Constants ──────────────────────────── */

const STEP_CONFIG = [
  { id: 'orgtype',      label: 'Org Type',   icon: '&#127963;' },
  { id: 'industry',     label: 'Industry',   icon: '&#128188;' },
  { id: 'source',       label: 'Source',      icon: '&#127760;' },
  { id: 'discovering',  label: 'Discover',    icon: '&#128269;' },
  { id: 'select',       label: 'Select',      icon: '&#128101;' },
  { id: 'linkgpts',     label: 'Link GPTs',   icon: '&#128279;' },
  { id: 'review',       label: 'Review',      icon: '&#9989;'  },
  { id: 'deploy',       label: 'Deploy',      icon: '&#128640;' },
];

const ORG_TYPES = [
  { value: 'municipal',        title: 'Municipal Government', icon: '&#127963;', desc: 'City halls, town councils, and municipal services' },
  { value: 'county',           title: 'County Government',    icon: '&#127961;', desc: 'County administration, commissions, and services' },
  { value: 'school-district',  title: 'School District',      icon: '&#127979;', desc: 'K-12 school districts and education boards' },
  { value: 'university',       title: 'College / University', icon: '&#127891;', desc: 'Higher education institutions and campuses' },
  { value: 'state-agency',     title: 'State Agency',         icon: '&#127970;', desc: 'State-level departments and regulatory bodies' },
  { value: 'federal-agency',   title: 'Federal Agency',       icon: '&#127988;', desc: 'Federal departments, bureaus, and administrations' },
  { value: 'enterprise',       title: 'Enterprise Business',  icon: '&#128188;', desc: 'Large-scale corporate and enterprise organizations' },
  { value: 'nonprofit',        title: 'Non-Profit',           icon: '&#129309;', desc: 'Charitable organizations and foundations' },
  { value: 'healthcare',       title: 'Healthcare System',    icon: '&#127973;', desc: 'Hospitals, clinics, and health networks' },
  { value: 'custom',           title: 'Custom',               icon: '&#9881;',   desc: 'Define your own organization structure' },
];

const INDUSTRIES = [
  { value: 'government',  title: 'Government',    icon: '&#127963;', badges: ['FOIA', 'ADA'],                 desc: 'Public-sector compliance with transparency and accessibility' },
  { value: 'healthcare',  title: 'Healthcare',     icon: '&#127973;', badges: ['HIPAA'],                       desc: 'Patient data protection and healthcare regulations' },
  { value: 'education',   title: 'Education',      icon: '&#127891;', badges: ['FERPA'],                       desc: 'Student records privacy and educational standards' },
  { value: 'finance',     title: 'Finance',        icon: '&#128176;', badges: ['SOX', 'PCI-DSS'],              desc: 'Financial reporting and payment card security' },
  { value: 'legal',       title: 'Legal',          icon: '&#9878;',   badges: ['Attorney-Client'],             desc: 'Privileged communications and legal compliance' },
  { value: 'technology',  title: 'Technology',     icon: '&#128187;', badges: ['SOC2'],                        desc: 'Security controls and data handling standards' },
  { value: 'other',       title: 'Other / Custom', icon: '&#9881;',   badges: [],                              desc: 'Custom compliance framework configuration' },
];

const DOMAIN_FILTERS = [
  'All', 'HR', 'Finance', 'Legal', 'PublicHealth', 'PublicSafety',
  'Parks', 'Building', 'Utilities', 'IT', 'Communications', 'General',
];

const TEMPLATE_OPTIONS = [
  { value: '', label: 'Auto-detect' },
  { value: 'customer-service', label: 'Customer Service' },
  { value: 'internal-ops', label: 'Internal Operations' },
  { value: 'public-info', label: 'Public Information' },
  { value: 'data-portal', label: 'Data Portal' },
  { value: 'executive', label: 'Executive' },
  { value: 'hr', label: 'Human Resources' },
  { value: 'finance', label: 'Finance & Budget' },
  { value: 'legal', label: 'Legal & Compliance' },
  { value: 'it', label: 'IT & Technology' },
];

/* ──────────────────────────── Page Class ─────────────────────────── */

export class OnboardingPage {
  constructor(app) {
    this.state  = app.state;
    this.api    = app.api;
    this.router = app.router;

    // Wizard state
    this._wizardId   = null;
    this._wizard     = null;
    this._pollTimer  = null;
    this._jobId      = null;
    this._discovery  = null;
    this._agents     = [];
    this._filter     = 'All';
    this._step       = 'orgtype';

    // New step data
    this._selectedOrgType  = null;
    this._selectedIndustry = null;
    this._sourceMode       = 'website';   // 'website' | 'manual'
    this._gptLinks         = {};          // agentId -> url
    this._manualDepts      = '';
    this._selectSearchQuery = '';
  }

  /* ═══════════════════════ Render & Lifecycle ═══════════════════════ */

  render(mount) {
    this._mount = mount;

    mount.innerHTML = `
      <div class="page page-onboarding">
        <header class="page-header" style="background:linear-gradient(135deg, var(--accent) 0%, #7c3aed 100%); padding:1.5rem 2rem; border-radius:12px; margin-bottom:1.5rem; color:#fff">
          <h1 style="margin:0; font-size:1.5rem; font-weight:700">Onboarding Wizard</h1>
          <p style="margin:0.25rem 0 0; opacity:0.85; font-size:0.9rem">Set up AI agents for your organization in minutes</p>
        </header>

        <div id="onb-progress-bar" class="glass-card" style="padding:1rem 1.5rem; margin-bottom:1.5rem"></div>

        <div id="onb-content"></div>

        <div id="onb-history" style="margin-top:2rem"></div>
      </div>
    `;

    this._injectKeyframes();
    this._renderProgressBar();
    this._renderStep();
    this._loadHistory();

    return () => this._cleanup();
  }

  _cleanup() {
    if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
  }

  /** Inject reusable CSS keyframes once */
  _injectKeyframes() {
    if (document.getElementById('onb-keyframes')) return;
    const style = document.createElement('style');
    style.id = 'onb-keyframes';
    style.textContent = `
      .pulse-dot { animation: onb-pulse 1.5s ease-in-out infinite; }
      @keyframes onb-pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
      .spinner-orbit { border:3px solid rgba(255,255,255,0.3); border-top-color:#fff; border-radius:50%; animation:onb-spin 1s linear infinite; }
      @keyframes onb-spin { to { transform:rotate(360deg); } }
      @keyframes onb-checkmark { 0% { transform:scale(0) rotate(-45deg); opacity:0; } 60% { transform:scale(1.2) rotate(0deg); opacity:1; } 100% { transform:scale(1) rotate(0deg); opacity:1; } }
      @keyframes onb-confetti { 0% { opacity:1; transform:translateY(0) scale(1); } 100% { opacity:0; transform:translateY(-60px) scale(0.5); } }
      .onb-card-grid { display:grid; gap:1rem; }
      .onb-card-grid.cols-2 { grid-template-columns:repeat(2,1fr); }
      .onb-card-grid.cols-3 { grid-template-columns:repeat(3,1fr); }
      .onb-card-grid.cols-5 { grid-template-columns:repeat(5,1fr); }
      @media(max-width:768px) {
        .onb-card-grid.cols-3, .onb-card-grid.cols-5 { grid-template-columns:repeat(2,1fr); }
      }
      @media(max-width:480px) {
        .onb-card-grid.cols-2, .onb-card-grid.cols-3, .onb-card-grid.cols-5 { grid-template-columns:1fr; }
      }
      .onb-selectable-card {
        cursor:pointer; padding:1.25rem; border-radius:12px; border:2px solid var(--glass-border);
        background:var(--glass-bg); transition:all 0.25s; text-align:center; user-select:none;
      }
      .onb-selectable-card:hover { border-color:var(--accent); transform:translateY(-2px); box-shadow:0 4px 12px rgba(0,0,0,0.1); }
      .onb-selectable-card.selected { border-color:var(--accent); background:rgba(99,102,241,0.08); box-shadow:0 0 0 3px rgba(99,102,241,0.15); }
      .onb-selectable-card .card-icon { font-size:2rem; margin-bottom:0.5rem; display:block; }
      .onb-selectable-card .card-title { font-weight:600; font-size:0.9rem; margin-bottom:0.25rem; }
      .onb-selectable-card .card-desc { font-size:0.75rem; color:var(--text-muted); line-height:1.3; }
      .onb-badge { display:inline-block; padding:0.15rem 0.5rem; border-radius:20px; font-size:0.65rem; font-weight:600; margin:0.15rem 0.1rem; }
      .onb-badge-compliance { background:rgba(245,158,11,0.15); color:#d97706; }
      .onb-badge-industry  { background:rgba(99,102,241,0.12); color:var(--accent); }
      .onb-source-toggle { display:flex; gap:1rem; margin-bottom:1.5rem; }
      .onb-source-option {
        flex:1; cursor:pointer; padding:1.25rem; border-radius:12px; border:2px solid var(--glass-border);
        background:var(--glass-bg); text-align:center; transition:all 0.25s;
      }
      .onb-source-option:hover { border-color:var(--accent); }
      .onb-source-option.active { border-color:var(--accent); background:rgba(99,102,241,0.08); }
    `;
    document.head.appendChild(style);
  }

  /* ═══════════════════════ Progress Bar ═════════════════════════════ */

  _renderProgressBar() {
    const bar = $('#onb-progress-bar');
    if (!bar) return;

    const currentIdx = STEP_CONFIG.findIndex(s => s.id === this._step);

    bar.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:0.25rem">
        ${STEP_CONFIG.map((s, i) => {
          const isActive   = i === currentIdx;
          const isComplete = i < currentIdx;
          const bg    = isActive ? 'var(--accent)' : isComplete ? 'var(--success, #22c55e)' : 'var(--glass-border)';
          const color = (isActive || isComplete) ? '#fff' : 'var(--text-muted)';
          const labelColor = isActive ? 'var(--accent)' : isComplete ? 'var(--success, #22c55e)' : 'var(--text-muted)';

          return `
            <div style="flex:0 0 auto; text-align:center; min-width:48px">
              <div style="width:32px; height:32px; border-radius:8px; background:${bg}; color:${color};
                          display:inline-flex; align-items:center; justify-content:center; font-size:0.95rem;
                          transition:all 0.3s">
                ${isComplete ? '&#10003;' : s.icon}
              </div>
              <div style="font-size:0.6rem; margin-top:0.2rem; font-weight:${isActive ? '600' : '400'};
                          color:${labelColor}; white-space:nowrap">${s.label}</div>
            </div>
            ${i < STEP_CONFIG.length - 1
              ? `<div style="flex:1; height:3px; border-radius:2px; background:${isComplete ? 'var(--success, #22c55e)' : 'var(--glass-border)'}; transition:background 0.3s; min-width:8px"></div>`
              : ''}
          `;
        }).join('')}
      </div>
    `;
  }

  /* ═══════════════════════ Step Router ══════════════════════════════ */

  _renderStep() {
    switch (this._step) {
      case 'orgtype':     this._renderOrgTypeStep();      break;
      case 'industry':    this._renderIndustryStep();      break;
      case 'source':      this._renderSourceStep();        break;
      case 'discovering': this._renderDiscoveringStep();   break;
      case 'select':      this._renderSelectStep();        break;
      case 'linkgpts':    this._renderLinkGPTsStep();      break;
      case 'review':      this._renderReviewStep();        break;
      case 'deploy':      this._renderDeployStep();        break;
    }
    this._renderProgressBar();
  }

  _setStep(step) {
    this._step = step;
    this._renderStep();
    // Scroll to top of content
    const content = $('#onb-content');
    if (content) content.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ═══════════════════ Step 1: Org Type Selection ══════════════════ */

  _renderOrgTypeStep() {
    const content = $('#onb-content');

    content.innerHTML = `
      <div class="glass-card" style="padding:2rem; max-width:800px; margin:0 auto">
        <h2 style="margin:0 0 0.25rem">What type of organization are you?</h2>
        <p style="color:var(--text-muted); margin:0 0 1.5rem; font-size:0.9rem">
          Select your organization type so we can tailor agent templates and compliance requirements.
        </p>

        <div class="onb-card-grid cols-5" id="onb-orgtype-grid">
          ${ORG_TYPES.map(org => `
            <div class="onb-selectable-card ${this._selectedOrgType === org.value ? 'selected' : ''}"
                 data-org-type="${org.value}">
              <span class="card-icon">${org.icon}</span>
              <div class="card-title">${escapeHtml(org.title)}</div>
              <div class="card-desc">${escapeHtml(org.desc)}</div>
            </div>
          `).join('')}
        </div>

        <div style="margin-top:1.5rem; display:flex; justify-content:flex-end">
          <button class="btn btn-primary" id="onb-orgtype-continue" ${!this._selectedOrgType ? 'disabled' : ''}
                  style="padding:0.65rem 2rem; font-size:0.95rem">
            Continue &#8594;
          </button>
        </div>
      </div>
    `;

    // Card selection
    const grid = $('#onb-orgtype-grid');
    grid.addEventListener('click', (e) => {
      const card = e.target.closest('[data-org-type]');
      if (!card) return;
      this._selectedOrgType = card.dataset.orgType;
      // Update visual selection
      grid.querySelectorAll('.onb-selectable-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      $('#onb-orgtype-continue').disabled = false;
    });

    $('#onb-orgtype-continue').addEventListener('click', () => {
      if (!this._selectedOrgType) { showToast('Please select an organization type', 'warning'); return; }
      this._setStep('industry');
    });

    // Show history
    const history = $('#onb-history');
    if (history) history.style.display = 'block';
  }

  /* ═══════════════════ Step 2: Industry Selection ══════════════════ */

  _renderIndustryStep() {
    const content = $('#onb-content');

    content.innerHTML = `
      <div class="glass-card" style="padding:2rem; max-width:750px; margin:0 auto">
        <h2 style="margin:0 0 0.25rem">Select Your Industry</h2>
        <p style="color:var(--text-muted); margin:0 0 1.5rem; font-size:0.9rem">
          Choose an industry to auto-apply relevant compliance guardrails to every agent.
        </p>

        <div class="onb-card-grid cols-3" id="onb-industry-grid" style="margin-bottom:1rem">
          ${INDUSTRIES.map(ind => `
            <div class="onb-selectable-card ${this._selectedIndustry === ind.value ? 'selected' : ''}"
                 data-industry="${ind.value}" style="text-align:left; padding:1.25rem">
              <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:0.5rem">
                <span style="font-size:1.75rem">${ind.icon}</span>
                <div class="card-title" style="margin:0">${escapeHtml(ind.title)}</div>
              </div>
              <div class="card-desc" style="margin-bottom:0.5rem">${escapeHtml(ind.desc)}</div>
              <div style="display:flex; flex-wrap:wrap; gap:0.25rem">
                ${ind.badges.map(b => `<span class="onb-badge onb-badge-compliance">${escapeHtml(b)}</span>`).join('')}
                ${ind.badges.length === 0 ? '<span style="font-size:0.7rem; color:var(--text-muted); font-style:italic">Custom compliance</span>' : ''}
              </div>
            </div>
          `).join('')}
        </div>

        ${this._selectedIndustry ? this._renderCompliancePreview() : ''}

        <div style="margin-top:1.5rem; display:flex; justify-content:space-between">
          <button class="btn btn-ghost" id="onb-industry-back">&#8592; Back</button>
          <button class="btn btn-primary" id="onb-industry-continue" ${!this._selectedIndustry ? 'disabled' : ''}
                  style="padding:0.65rem 2rem; font-size:0.95rem">
            Continue &#8594;
          </button>
        </div>
      </div>
    `;

    // Card selection
    const grid = $('#onb-industry-grid');
    grid.addEventListener('click', (e) => {
      const card = e.target.closest('[data-industry]');
      if (!card) return;
      this._selectedIndustry = card.dataset.industry;
      // Re-render to show compliance preview
      this._renderIndustryStep();
    });

    $('#onb-industry-back').addEventListener('click', () => this._setStep('orgtype'));
    $('#onb-industry-continue').addEventListener('click', () => {
      if (!this._selectedIndustry) { showToast('Please select an industry', 'warning'); return; }
      this._setStep('source');
    });
  }

  /** Render a small compliance preview box below the industry grid */
  _renderCompliancePreview() {
    const industry = INDUSTRIES.find(i => i.value === this._selectedIndustry);
    if (!industry || industry.badges.length === 0) return '';

    return `
      <div style="padding:1rem; background:rgba(245,158,11,0.06); border:1px solid rgba(245,158,11,0.2);
                  border-radius:8px; margin-top:0.5rem">
        <div style="font-weight:600; font-size:0.85rem; margin-bottom:0.5rem; color:#d97706">
          &#128274; Compliance guardrails that will be enforced:
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:0.35rem">
          ${industry.badges.map(b => `<span class="onb-badge onb-badge-compliance" style="font-size:0.75rem; padding:0.2rem 0.6rem">${escapeHtml(b)}</span>`).join('')}
        </div>
        <p style="margin:0.5rem 0 0; font-size:0.78rem; color:var(--text-muted)">
          These rules will be automatically applied to all agents during deployment.
        </p>
      </div>
    `;
  }

  /* ═══════════════════ Step 3: Source ══════════════════════════════ */

  _renderSourceStep() {
    const content = $('#onb-content');

    content.innerHTML = `
      <div class="glass-card" style="padding:2rem; max-width:700px; margin:0 auto">
        <h2 style="margin:0 0 0.25rem">Discover Your Organization</h2>
        <p style="color:var(--text-muted); margin:0 0 1.5rem; font-size:0.9rem">
          Choose how to provide your organization structure: crawl a website automatically or enter departments manually.
        </p>

        <!-- Source Mode Toggle -->
        <div class="onb-source-toggle" id="onb-source-toggle">
          <div class="onb-source-option ${this._sourceMode === 'website' ? 'active' : ''}" data-mode="website">
            <div style="font-size:1.75rem; margin-bottom:0.5rem">&#127760;</div>
            <div style="font-weight:600; font-size:0.9rem">Website Discovery</div>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.25rem">Auto-crawl your website to find departments</div>
          </div>
          <div class="onb-source-option ${this._sourceMode === 'manual' ? 'active' : ''}" data-mode="manual">
            <div style="font-size:1.75rem; margin-bottom:0.5rem">&#9997;</div>
            <div style="font-weight:600; font-size:0.9rem">Manual Entry</div>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.25rem">Type department names one per line</div>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:1rem">
          <label class="form-label">Organization Name
            <input type="text" class="form-input" id="onb-org-name" placeholder="e.g. City of Cleveland"
                   value="${escapeHtml(this._wizard?.organization_name || '')}" />
          </label>

          <!-- Website mode fields -->
          <div id="onb-website-fields" style="display:${this._sourceMode === 'website' ? 'flex' : 'none'}; flex-direction:column; gap:1rem">
            <label class="form-label">Website URL
              <input type="url" class="form-input" id="onb-url" placeholder="e.g. clevelandohio.gov"
                     style="font-size:1.1rem; padding:0.75rem"
                     value="${escapeHtml(this._wizard?.website_url || '')}" />
            </label>
          </div>

          <!-- Manual mode fields -->
          <div id="onb-manual-fields" style="display:${this._sourceMode === 'manual' ? 'flex' : 'none'}; flex-direction:column; gap:1rem">
            <label class="form-label">Departments (one per line)
              <textarea class="form-input" id="onb-manual-depts" rows="8"
                        placeholder="e.g.&#10;Human Resources&#10;Finance Department&#10;Public Safety&#10;Parks and Recreation&#10;Legal Department"
                        style="font-family:inherit; resize:vertical">${escapeHtml(this._manualDepts)}</textarea>
            </label>
          </div>

          <div style="padding:1rem; background:var(--glass-bg); border:1px solid var(--glass-border); border-radius:8px; margin-top:0.25rem">
            <div style="font-weight:600; font-size:0.85rem; margin-bottom:0.5rem">What we'll discover:</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; font-size:0.8rem; color:var(--text-muted)">
              <span>&#128100; Executives & leadership</span>
              <span>&#127970; Departments & teams</span>
              <span>&#128202; Data sources & portals</span>
              <span>&#128196; Policies & documents</span>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; margin-top:0.5rem">
            <button class="btn btn-ghost" id="onb-source-back">&#8592; Back</button>
            <button class="btn btn-primary" id="onb-discover-btn" style="padding:0.75rem 2rem; font-size:1rem">
              ${this._sourceMode === 'website' ? '&#128269; Start Discovery' : '&#10004; Continue with Departments'}
            </button>
          </div>
        </div>
      </div>
    `;

    // Source mode toggle
    const toggle = $('#onb-source-toggle');
    toggle.addEventListener('click', (e) => {
      const option = e.target.closest('[data-mode]');
      if (!option) return;
      this._sourceMode = option.dataset.mode;
      toggle.querySelectorAll('.onb-source-option').forEach(o => o.classList.remove('active'));
      option.classList.add('active');

      const websiteFields = $('#onb-website-fields');
      const manualFields  = $('#onb-manual-fields');
      const btn = $('#onb-discover-btn');

      if (this._sourceMode === 'website') {
        websiteFields.style.display = 'flex';
        manualFields.style.display  = 'none';
        btn.innerHTML = '&#128269; Start Discovery';
      } else {
        websiteFields.style.display = 'none';
        manualFields.style.display  = 'flex';
        btn.innerHTML = '&#10004; Continue with Departments';
      }
    });

    // Discover / continue button
    $('#onb-discover-btn').addEventListener('click', () => {
      if (this._sourceMode === 'website') {
        this._startAsyncDiscovery();
      } else {
        this._startManualDiscovery();
      }
    });

    // Enter key on URL input
    const urlInput = $('#onb-url');
    if (urlInput) urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this._startAsyncDiscovery(); });

    // Back
    $('#onb-source-back').addEventListener('click', () => this._setStep('industry'));

    // Show history on source step
    const history = $('#onb-history');
    if (history) history.style.display = 'block';
  }

  /* ═══════════════════ Step 4: Discovering (async polling) ═════════ */

  async _startAsyncDiscovery() {
    const orgName = $('#onb-org-name')?.value.trim();
    let url = $('#onb-url')?.value.trim();

    if (!orgName || !url) {
      showToast('Please enter organization name and URL', 'warning');
      return;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const btn = $('#onb-discover-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '&#9203; Starting...'; }

    try {
      // 1. Create wizard
      const wizard = await this.api._post('/api/onboarding/start', {
        organizationName: orgName,
        websiteUrl: url,
        organizationType: this._selectedOrgType || 'municipal',
        industry: this._selectedIndustry || 'government',
      });
      this._wizardId = wizard.id;
      this._wizard   = wizard;

      // 2. Start async discovery job
      const job = await this.api._post('/api/onboarding/discover', { url });
      this._jobId = job.job_id;

      // 3. Hide history, switch to discovering step
      const history = $('#onb-history');
      if (history) history.style.display = 'none';

      this._setStep('discovering');
      this._startPolling();

    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '&#128269; Start Discovery'; }
    }
  }

  /** Manual entry: build agents from a textarea list */
  async _startManualDiscovery() {
    const orgName = $('#onb-org-name')?.value.trim();
    const deptText = $('#onb-manual-depts')?.value.trim();

    if (!orgName) {
      showToast('Please enter an organization name', 'warning');
      return;
    }
    if (!deptText) {
      showToast('Please enter at least one department name', 'warning');
      return;
    }

    this._manualDepts = deptText;

    const btn = $('#onb-discover-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '&#9203; Processing...'; }

    try {
      // Create wizard without website URL
      const wizard = await this.api._post('/api/onboarding/start', {
        organizationName: orgName,
        organizationType: this._selectedOrgType || 'municipal',
        industry: this._selectedIndustry || 'government',
        manualEntry: true,
      });
      this._wizardId = wizard.id;
      this._wizard   = wizard;

      // Parse department lines
      const deptNames = deptText.split('\n').map(l => l.trim()).filter(Boolean);
      this._agents = deptNames.map((name, i) => ({
        id: `manual-${i}`,
        name,
        title: 'Department',
        enabled: true,
        domain: 'General',
        director: '',
        suggestedTemplate: '',
        url: '',
      }));

      this._discovery = {
        status: 'completed',
        pagesCrawled: 0,
        departments: this._agents,
        sourceUrl: 'Manual Entry',
      };

      const history = $('#onb-history');
      if (history) history.style.display = 'none';

      showToast(`Created ${deptNames.length} departments from manual entry`, 'success');
      this._setStep('select');

    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '&#10004; Continue with Departments'; }
    }
  }

  _renderDiscoveringStep() {
    const d = this._discovery;
    const content = $('#onb-content');

    content.innerHTML = `
      <div class="glass-card" style="padding:0; overflow:hidden">
        <div style="background:linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); padding:1.5rem; color:#fff">
          <div style="display:flex; align-items:center; gap:1rem">
            <div class="spinner-orbit" style="width:48px; height:48px"></div>
            <div>
              <h2 style="margin:0; font-size:1.25rem">Discovering...</h2>
              <p style="margin:0; opacity:0.85; font-size:0.85rem">${escapeHtml(this._wizard?.website_url || '')}</p>
            </div>
          </div>
        </div>
        <div style="padding:1.5rem">
          <div style="display:flex; align-items:center; gap:0.5rem; padding:0.75rem; border-radius:8px;
                      background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.3); margin-bottom:1rem">
            <span class="pulse-dot" style="width:10px; height:10px; border-radius:50%; background:#f59e0b; display:inline-block"></span>
            <span style="font-weight:600; color:#d97706" id="onb-status-text">${d ? d.status : 'Starting...'}</span>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem">
            <div class="glass-card" style="padding:1.25rem; text-align:center">
              <div style="font-size:2.5rem; font-weight:700; color:var(--accent)" id="onb-pages-count">${d ? d.pagesCrawled : 0}</div>
              <div style="font-size:0.8rem; color:var(--text-muted)">Pages Crawled</div>
            </div>
            <div class="glass-card" style="padding:1.25rem; text-align:center">
              <div style="font-size:2.5rem; font-weight:700; color:var(--success, #22c55e)" id="onb-items-count">${d ? ((d.departments?.length || 0) + (d.chiefOfficers?.length || 0) + (d.executive ? 1 : 0)) : 0}</div>
              <div style="font-size:0.8rem; color:var(--text-muted)">Items Found</div>
            </div>
          </div>

          <div style="margin-top:1rem; height:6px; background:var(--glass-border); border-radius:3px; overflow:hidden">
            <div id="onb-crawl-progress" style="height:100%; background:linear-gradient(90deg, #f59e0b, #ef4444);
                     border-radius:3px; width:5%; transition:width 0.5s"></div>
          </div>
        </div>
      </div>
    `;
  }

  _startPolling() {
    if (this._pollTimer) clearInterval(this._pollTimer);

    this._pollTimer = setInterval(async () => {
      try {
        const data = await this.api._get(`/api/onboarding/discover/${this._jobId}`);
        this._discovery = data;

        // Update live counters
        const pagesEl    = $('#onb-pages-count');
        const itemsEl    = $('#onb-items-count');
        const statusEl   = $('#onb-status-text');
        const progressEl = $('#onb-crawl-progress');

        if (pagesEl)  pagesEl.textContent  = data.pagesCrawled || 0;
        if (itemsEl)  itemsEl.textContent  = (data.departments?.length || 0) + (data.chiefOfficers?.length || 0) + (data.executive ? 1 : 0);
        if (statusEl) statusEl.textContent = data.status === 'extracting'
          ? 'Extracting org structure...'
          : data.status === 'crawling'
            ? `Crawling... (${data.pagesCrawled} pages)`
            : data.status;

        // Animate progress bar
        if (progressEl) {
          const pct = data.status === 'extracting' ? 80 : Math.min((data.pagesCrawled / 50) * 70, 70);
          progressEl.style.width = `${pct}%`;
        }

        if (data.status === 'completed') {
          clearInterval(this._pollTimer);
          this._pollTimer = null;
          if (progressEl) progressEl.style.width = '100%';

          // Apply discovery to wizard
          await this.api._post(`/api/onboarding/wizards/${this._wizardId}/apply-discovery`, {
            discoveryResult: data,
          });
          this._wizard = await this.api._get(`/api/onboarding/wizards/${this._wizardId}`);

          // Build agents list from discovery
          this._buildAgentsFromDiscovery(data);

          setTimeout(() => this._setStep('select'), 500);
        } else if (data.status === 'failed') {
          clearInterval(this._pollTimer);
          this._pollTimer = null;
          showToast(`Discovery failed: ${data.error || 'Unknown error'}`, 'error');
          this._setStep('source');
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
    }, 2000);
  }

  _buildAgentsFromDiscovery(data) {
    this._agents = [];

    // Executive
    if (data.executive) {
      this._agents.push({
        id: 'executive',
        name: data.executive.name,
        title: data.executive.title || 'Executive',
        enabled: true,
        domain: 'Executive',
        director: data.executive.name,
        isExecutive: true,
        url: data.executive.url,
        suggestedTemplate: 'executive',
      });
    }

    // Departments
    (data.departments || []).forEach((dept) => {
      this._agents.push({
        id: dept.id,
        name: dept.name,
        title: dept.directorTitle || 'Director',
        enabled: true,
        domain: this._wizard?.departments?.find(d => d.name === dept.name)?.suggestedDomain || 'General',
        director: dept.director,
        suggestedTemplate: dept.suggestedTemplate || '',
        url: dept.url,
      });
    });

    // Chief officers
    (data.chiefOfficers || []).forEach((officer, i) => {
      this._agents.push({
        id: `officer-${i}`,
        name: officer.name,
        title: officer.title || 'Chief Officer',
        enabled: true,
        domain: 'Executive',
        director: officer.name,
        url: officer.url,
        suggestedTemplate: 'executive',
      });
    });
  }

  /* ═══════════════════ Step 5: Select Agents ══════════════════════ */

  _renderSelectStep() {
    const agents      = this._agents;
    const enabledCount = agents.filter(a => a.enabled).length;
    const discovery    = this._discovery || {};

    const content = $('#onb-content');
    content.innerHTML = `
      <div class="glass-card" style="padding:1.5rem; margin-bottom:1rem">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem">
          <div>
            <h2 style="margin:0">Select Agents to Create</h2>
            <p style="color:var(--text-muted); margin:0.25rem 0 0; font-size:0.85rem">
              Found ${agents.length} potential agents from ${escapeHtml(discovery.sourceUrl || this._wizard?.website_url || 'manual entry')}
            </p>
          </div>
          <div style="display:flex; gap:0.5rem; align-items:center">
            <span class="onb-badge onb-badge-industry" style="font-size:0.75rem">${enabledCount} of ${agents.length} selected</span>
          </div>
        </div>

        <div style="display:flex; gap:0.5rem; margin-top:1rem; align-items:center; flex-wrap:wrap">
          <button class="btn btn-sm btn-ghost" id="onb-select-all">Select All</button>
          <button class="btn btn-sm btn-ghost" id="onb-deselect-all">Deselect All</button>
        </div>

        <!-- Search Bar -->
        <div class="onb-search-bar" style="margin-top:0.75rem">
          <span class="onb-search-icon">&#128269;</span>
          <input type="text" class="form-input" id="onb-agent-search"
                 placeholder="Search agents by name..."
                 value="${escapeHtml(this._selectSearchQuery)}"
                 style="padding-left:36px" />
        </div>

        <!-- Filter Chips -->
        <div id="onb-filter-chips" class="onb-filter-chips" style="margin-top:0.75rem"></div>
      </div>

      <div id="onb-agents-list" style="max-height:500px; overflow-y:auto; padding-right:0.5rem"></div>

      <div style="margin-top:1.5rem; display:flex; justify-content:space-between">
        <button class="btn btn-ghost" id="onb-back-source">&#8592; Back</button>
        <button class="btn btn-primary" id="onb-to-linkgpts" ${enabledCount === 0 ? 'disabled' : ''}
                style="padding:0.65rem 2rem; font-size:0.95rem">
          Continue &#8594;
        </button>
      </div>
    `;

    this._renderAgentsList();

    // Bind events
    $('#onb-select-all').addEventListener('click', () => {
      this._agents.forEach(a => { a.enabled = true; });
      this._renderSelectStep();
      this._saveDepartmentsBulk('enable-all');
    });

    $('#onb-deselect-all').addEventListener('click', () => {
      this._agents.forEach(a => { a.enabled = false; });
      this._renderSelectStep();
      this._saveDepartmentsBulk('disable-all');
    });

    // Render filter chips
    this._renderSelectFilterChips();

    // Search input
    const searchInput = $('#onb-agent-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this._selectSearchQuery = e.target.value.trim().toLowerCase();
        this._renderAgentsList();
      });
    }

    $('#onb-back-source').addEventListener('click', () => this._setStep('source'));
    $('#onb-to-linkgpts').addEventListener('click', () => {
      const enabledNow = this._agents.filter(a => a.enabled).length;
      if (enabledNow === 0) { showToast('Select at least one agent to continue', 'warning'); return; }
      this._setStep('linkgpts');
    });
  }

  /** Render dynamic domain filter chips */
  _renderSelectFilterChips() {
    const container = $('#onb-filter-chips');
    if (!container) return;

    const domainCounts = new Map();
    domainCounts.set('All', this._agents.length);
    for (const agent of this._agents) {
      const d = agent.domain || 'General';
      domainCounts.set(d, (domainCounts.get(d) || 0) + 1);
    }

    container.innerHTML = Array.from(domainCounts.entries())
      .map(([domain, count]) => {
        const active = this._filter === domain ? 'active' : '';
        return `<button class="onb-filter-chip ${active}" data-domain="${domain}">${domain} <span class="chip-count">(${count})</span></button>`;
      })
      .join('');

    container.querySelectorAll('.onb-filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this._filter = chip.dataset.domain;
        container.querySelectorAll('.onb-filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this._renderAgentsList();
      });
    });
  }

  _renderAgentsList() {
    const list = $('#onb-agents-list');
    if (!list) return;

    let filtered = this._filter === 'All'
      ? this._agents
      : this._agents.filter(a => (a.domain || 'General') === this._filter);

    // Apply search filter
    if (this._selectSearchQuery) {
      const q = this._selectSearchQuery;
      filtered = filtered.filter(a => a.name.toLowerCase().includes(q));
    }

    if (!filtered.length) {
      list.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--text-muted)">
        ${this._agents.length ? 'No agents match this filter.' : 'No agents discovered. Try a different URL.'}
      </div>`;
      return;
    }

    // Clear and build DOM (using createToggle component)
    list.innerHTML = '';

    filtered.forEach((agent) => {
      const globalIdx = this._agents.indexOf(agent);
      const card = document.createElement('div');
      card.className = 'glass-card';
      card.style.cssText = `padding:1rem; margin-bottom:0.5rem; border:2px solid;
        ${agent.enabled
          ? 'border-color:var(--success, #22c55e); background:rgba(34,197,94,0.05)'
          : 'border-color:transparent; opacity:0.6'};
        transition:all 0.2s`;
      card.dataset.agentIdx = globalIdx;

      // Row layout
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; align-items:flex-start; gap:0.75rem';

      // Toggle switch
      const toggleWrapper = document.createElement('div');
      toggleWrapper.style.cssText = 'margin-top:0.3rem; flex-shrink:0';
      const toggle = createToggle({
        checked: agent.enabled,
        onChange: (checked) => {
          this._agents[globalIdx].enabled = checked;
          card.style.borderColor = checked ? 'var(--success, #22c55e)' : 'transparent';
          card.style.background  = checked ? 'rgba(34,197,94,0.05)' : '';
          card.style.opacity     = checked ? '1' : '0.6';
          // Update header count
          this._updateSelectCount();
        },
      });
      toggleWrapper.appendChild(toggle);

      // Main info section
      const info = document.createElement('div');
      info.style.cssText = 'flex:1; min-width:0';

      // Name row with editable input
      const nameRow = document.createElement('div');
      nameRow.style.cssText = 'display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap; margin-bottom:0.35rem';

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'form-input';
      nameInput.value = agent.name;
      nameInput.style.cssText = 'font-size:0.9rem; font-weight:600; padding:0.25rem 0.5rem; max-width:260px; border:1px solid transparent; background:transparent; border-radius:6px;';
      nameInput.addEventListener('focus', () => { nameInput.style.borderColor = 'var(--accent)'; nameInput.style.background = 'var(--glass-bg)'; });
      nameInput.addEventListener('blur', () => {
        nameInput.style.borderColor = 'transparent'; nameInput.style.background = 'transparent';
        this._agents[globalIdx].name = nameInput.value.trim() || agent.name;
      });

      nameRow.appendChild(nameInput);

      if (agent.isExecutive) {
        const execBadge = document.createElement('span');
        execBadge.className = 'badge';
        execBadge.style.cssText = 'background:rgba(245,158,11,0.15); color:#d97706; font-size:0.65rem';
        execBadge.textContent = 'Executive';
        nameRow.appendChild(execBadge);
      }

      const domainBadge = document.createElement('span');
      domainBadge.className = 'badge';
      domainBadge.style.cssText = 'font-size:0.65rem';
      domainBadge.textContent = agent.domain;
      nameRow.appendChild(domainBadge);

      info.appendChild(nameRow);

      // Director line
      if (agent.director) {
        const dirLine = document.createElement('div');
        dirLine.style.cssText = 'font-size:0.8rem; color:var(--text-muted); margin-bottom:0.35rem';
        dirLine.textContent = `${agent.title}: ${agent.director}`;
        info.appendChild(dirLine);
      }

      // Template dropdown
      const templateRow = document.createElement('div');
      templateRow.style.cssText = 'display:flex; align-items:center; gap:0.5rem; margin-top:0.25rem';

      const templateLabel = document.createElement('span');
      templateLabel.style.cssText = 'font-size:0.75rem; color:var(--text-muted)';
      templateLabel.textContent = 'Template:';
      templateRow.appendChild(templateLabel);

      const templateSelect = document.createElement('select');
      templateSelect.className = 'form-input';
      templateSelect.style.cssText = 'width:auto; padding:0.2rem 0.4rem; font-size:0.75rem';
      TEMPLATE_OPTIONS.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        if ((agent.suggestedTemplate || '') === opt.value) option.selected = true;
        templateSelect.appendChild(option);
      });
      templateSelect.addEventListener('change', () => {
        this._agents[globalIdx].suggestedTemplate = templateSelect.value;
      });
      templateRow.appendChild(templateSelect);

      info.appendChild(templateRow);

      // External link
      const linkEl = document.createElement('div');
      linkEl.style.cssText = 'flex-shrink:0; margin-top:0.3rem';
      if (agent.url) {
        linkEl.innerHTML = `<a href="${escapeHtml(agent.url)}" target="_blank" rel="noopener"
                              style="color:var(--text-muted); font-size:0.75rem" title="View source">&#128279;</a>`;
      }

      row.appendChild(toggleWrapper);
      row.appendChild(info);
      row.appendChild(linkEl);
      card.appendChild(row);
      list.appendChild(card);
    });
  }

  /** Update the "X of Y selected" badge without full re-render */
  _updateSelectCount() {
    const countBadge = document.querySelector('.onb-badge-industry');
    const btn = $('#onb-to-linkgpts');
    const enabledCount = this._agents.filter(a => a.enabled).length;
    if (countBadge) countBadge.textContent = `${enabledCount} of ${this._agents.length} selected`;
    if (btn) btn.disabled = enabledCount === 0;
  }

  async _saveDepartmentsBulk(action) {
    if (!this._wizardId) return;
    try {
      await this.api._put(`/api/onboarding/wizards/${this._wizardId}/departments-bulk`, { action });
    } catch { /* non-critical */ }
  }

  /* ═══════════════════ Step 6: Link GPTs ══════════════════════════ */

  _renderLinkGPTsStep() {
    const enabledAgents = this._agents.filter(a => a.enabled);

    const content = $('#onb-content');
    content.innerHTML = `
      <div class="glass-card" style="padding:2rem; max-width:750px; margin:0 auto">
        <h2 style="margin:0 0 0.25rem">Link Existing GPTs</h2>
        <p style="color:var(--text-muted); margin:0 0 1.25rem; font-size:0.9rem">
          Optionally link existing OpenAI GPTs to each agent. You can paste a GPT share URL to connect it.
          This step is optional -- you can skip it and link GPTs later.
        </p>

        <!-- Bulk import -->
        <div style="padding:1rem; background:var(--glass-bg); border:1px solid var(--glass-border); border-radius:10px; margin-bottom:1.5rem">
          <div style="font-weight:600; font-size:0.85rem; margin-bottom:0.5rem">&#128230; Bulk Import</div>
          <p style="font-size:0.78rem; color:var(--text-muted); margin:0 0 0.75rem">
            Paste multiple GPT URLs (one per line). They will be assigned to agents in order.
          </p>
          <textarea class="form-input" id="onb-gpt-bulk" rows="4"
                    placeholder="https://chat.openai.com/g/g-abc123&#10;https://chat.openai.com/g/g-def456&#10;..."
                    style="font-family:monospace; font-size:0.8rem; resize:vertical"></textarea>
          <button class="btn btn-sm btn-ghost" id="onb-gpt-bulk-apply" style="margin-top:0.5rem">
            Apply Bulk URLs
          </button>
        </div>

        <!-- Per-agent URL inputs -->
        <div style="margin-bottom:1rem">
          <div style="font-weight:600; font-size:0.85rem; margin-bottom:0.75rem">&#128279; Per-Agent GPT Links</div>
          <div id="onb-gpt-agent-list" style="display:flex; flex-direction:column; gap:0.5rem; max-height:400px; overflow-y:auto">
            ${enabledAgents.map((agent, i) => `
              <div style="display:flex; align-items:center; gap:0.75rem; padding:0.6rem 0.75rem;
                          border-radius:8px; background:var(--glass-bg); border:1px solid var(--glass-border)">
                <div style="flex:0 0 180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
                            font-size:0.85rem; font-weight:500" title="${escapeHtml(agent.name)}">
                  ${escapeHtml(agent.name)}
                </div>
                <input type="url" class="form-input onb-gpt-url" data-agent-id="${escapeHtml(agent.id)}"
                       placeholder="https://chat.openai.com/g/..."
                       value="${escapeHtml(this._gptLinks[agent.id] || '')}"
                       style="flex:1; padding:0.3rem 0.5rem; font-size:0.8rem; font-family:monospace" />
              </div>
            `).join('')}
          </div>
        </div>

        <div style="padding:0.75rem 1rem; background:rgba(59,130,246,0.06); border:1px solid rgba(59,130,246,0.15);
                    border-radius:8px; margin-bottom:1.5rem">
          <div style="font-size:0.8rem; color:var(--text-muted); line-height:1.5">
            <strong>How to get a GPT URL:</strong> Open your GPT in ChatGPT, click the share button,
            and copy the link. It should look like <code style="font-size:0.75rem; background:var(--glass-border); padding:0.1rem 0.3rem; border-radius:3px">https://chat.openai.com/g/g-xxxxxxxx</code>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between">
          <button class="btn btn-ghost" id="onb-gpt-back">&#8592; Back</button>
          <div style="display:flex; gap:0.5rem">
            <button class="btn btn-ghost" id="onb-gpt-skip">Skip</button>
            <button class="btn btn-primary" id="onb-gpt-continue" style="padding:0.65rem 2rem; font-size:0.95rem">
              Continue &#8594;
            </button>
          </div>
        </div>
      </div>
    `;

    // Bulk apply
    $('#onb-gpt-bulk-apply').addEventListener('click', () => {
      const bulkText = $('#onb-gpt-bulk')?.value.trim();
      if (!bulkText) { showToast('Paste at least one URL', 'warning'); return; }

      const urls = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
      const inputs = document.querySelectorAll('.onb-gpt-url');

      let applied = 0;
      urls.forEach((url, i) => {
        if (i < inputs.length) {
          inputs[i].value = url;
          const agentId = inputs[i].dataset.agentId;
          this._gptLinks[agentId] = url;
          applied++;
        }
      });

      showToast(`Applied ${applied} URL${applied !== 1 ? 's' : ''} to agents`, 'success');
    });

    // Save individual URLs on change
    const agentList = $('#onb-gpt-agent-list');
    agentList.addEventListener('input', (e) => {
      if (e.target.classList.contains('onb-gpt-url')) {
        const agentId = e.target.dataset.agentId;
        this._gptLinks[agentId] = e.target.value.trim();
      }
    });

    // Navigation
    $('#onb-gpt-back').addEventListener('click', () => this._setStep('select'));
    $('#onb-gpt-skip').addEventListener('click', () => this._setStep('review'));
    $('#onb-gpt-continue').addEventListener('click', () => {
      this._saveGPTLinksFromInputs();
      this._setStep('review');
    });
  }

  /** Collect GPT links from all inputs (in case not already captured by onInput) */
  _saveGPTLinksFromInputs() {
    const inputs = document.querySelectorAll('.onb-gpt-url');
    inputs.forEach(input => {
      const agentId = input.dataset.agentId;
      const val = input.value.trim();
      if (val) this._gptLinks[agentId] = val;
    });
  }

  /* ═══════════════════ Step 7: Review ═════════════════════════════ */

  _renderReviewStep() {
    const enabled    = this._agents.filter(a => a.enabled);
    const discovery  = this._wizard?.discovery_result || this._discovery || {};
    const orgName    = this._wizard?.organization_name || '';
    const industry   = INDUSTRIES.find(i => i.value === this._selectedIndustry);
    const orgType    = ORG_TYPES.find(o => o.value === this._selectedOrgType);
    const linkedCount = enabled.filter(a => this._gptLinks[a.id]).length;

    const content = $('#onb-content');
    content.innerHTML = `
      <div class="glass-card" style="padding:1.5rem; margin-bottom:1rem">
        <h2 style="margin:0 0 0.25rem">Review Configuration</h2>
        <p style="color:var(--text-muted); margin:0; font-size:0.85rem">Verify everything before deploying your agents</p>
      </div>

      <!-- Summary Grid -->
      <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:1rem; margin-bottom:1.5rem">
        <div class="glass-card" style="padding:1.25rem; text-align:center">
          <div style="font-size:2.25rem; font-weight:700; color:var(--accent)">${enabled.length}</div>
          <div style="font-size:0.75rem; color:var(--text-muted)">Agents</div>
        </div>
        <div class="glass-card" style="padding:1.25rem; text-align:center">
          <div style="font-size:2.25rem; font-weight:700; color:var(--success, #22c55e)">${discovery.pagesCrawled || 0}</div>
          <div style="font-size:0.75rem; color:var(--text-muted)">Pages Scanned</div>
        </div>
        <div class="glass-card" style="padding:1.25rem; text-align:center">
          <div style="font-size:2.25rem; font-weight:700; color:#f59e0b">${(discovery.dataPortals || []).length}</div>
          <div style="font-size:0.75rem; color:var(--text-muted)">Data Portals</div>
        </div>
        <div class="glass-card" style="padding:1.25rem; text-align:center">
          <div style="font-size:2.25rem; font-weight:700; color:#8b5cf6">${industry ? industry.badges.length : 0}</div>
          <div style="font-size:0.75rem; color:var(--text-muted)">Compliance Rules</div>
        </div>
      </div>

      <!-- Organization Details -->
      <div class="glass-card" style="padding:1.25rem; margin-bottom:1rem">
        <h4 style="margin:0 0 0.75rem; font-size:0.9rem">Organization Details</h4>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; font-size:0.85rem">
          <div><span style="color:var(--text-muted)">Organization:</span> <strong>${escapeHtml(orgName)}</strong></div>
          <div><span style="color:var(--text-muted)">Type:</span> <strong>${escapeHtml(orgType ? orgType.title : (this._wizard?.organization_type || ''))}</strong></div>
          <div><span style="color:var(--text-muted)">Industry:</span> <strong>${escapeHtml(industry ? industry.title : '')}</strong></div>
          <div><span style="color:var(--text-muted)">GPTs Linked:</span> <strong>${linkedCount} of ${enabled.length}</strong></div>
          ${discovery.municipality ? `<div><span style="color:var(--text-muted)">City:</span> <strong>${escapeHtml(discovery.municipality.name || '')}</strong></div>` : ''}
          ${discovery.executive ? `<div><span style="color:var(--text-muted)">Executive:</span> <strong>${escapeHtml(discovery.executive.name || '')}</strong></div>` : ''}
        </div>
      </div>

      <!-- Compliance Notice -->
      ${industry && industry.badges.length > 0 ? `
      <div class="glass-card" style="padding:1.25rem; margin-bottom:1rem; border:1px solid rgba(245,158,11,0.3); background:rgba(245,158,11,0.04)">
        <h4 style="margin:0 0 0.5rem; font-size:0.9rem; color:#d97706">&#128274; Compliance Guardrails</h4>
        <p style="font-size:0.8rem; color:var(--text-muted); margin:0 0 0.75rem">
          The following compliance frameworks will be enforced on all deployed agents:
        </p>
        <div style="display:flex; flex-wrap:wrap; gap:0.35rem">
          ${industry.badges.map(b => `<span class="onb-badge onb-badge-compliance" style="font-size:0.8rem; padding:0.25rem 0.75rem">${escapeHtml(b)}</span>`).join('')}
        </div>
      </div>
      ` : ''}

      <!-- Agent List -->
      <div class="glass-card" style="padding:1.25rem; margin-bottom:1.5rem">
        <h4 style="margin:0 0 0.75rem; font-size:0.9rem">Agents to be created (${enabled.length}):</h4>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; max-height:300px; overflow-y:auto">
          ${enabled.map(a => {
            const hasGpt = !!this._gptLinks[a.id];
            return `
              <div style="display:flex; align-items:center; gap:0.5rem; padding:0.5rem 0.75rem; border-radius:8px;
                          background:rgba(34,197,94,0.08); border:1px solid rgba(34,197,94,0.2); font-size:0.85rem">
                <span style="color:var(--success, #22c55e)">&#10003;</span>
                <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${escapeHtml(a.name)}</span>
                ${hasGpt ? '<span title="GPT linked" style="font-size:0.75rem">&#128279;</span>' : ''}
                <span class="badge" style="font-size:0.6rem">${escapeHtml(a.domain)}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; margin-top:1.5rem">
        <button class="btn btn-ghost" id="onb-back-linkgpts">&#8592; Back</button>
        <button class="btn btn-primary" id="onb-deploy-btn"
                style="background:linear-gradient(135deg, var(--success, #22c55e), #059669); padding:0.75rem 2rem; font-size:1rem">
          &#128640; Deploy All Agents
        </button>
      </div>
    `;

    $('#onb-back-linkgpts').addEventListener('click', () => this._setStep('linkgpts'));
    $('#onb-deploy-btn').addEventListener('click', () => this._doDeploy());
  }

  /* ═══════════════════ Step 8: Deploy ═════════════════════════════ */

  async _doDeploy() {
    const btn = $('#onb-deploy-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '&#9203; Deploying...'; }

    try {
      // Generate preview first
      await this.api._post(`/api/onboarding/wizards/${this._wizardId}/preview`);

      // Deploy
      const state = await this.api._post(`/api/onboarding/wizards/${this._wizardId}/deploy`, {
        skipApproval: true,
        gptLinks: this._gptLinks,
        industry: this._selectedIndustry,
        organizationType: this._selectedOrgType,
      });
      this._wizard = state;

      if (state.step === 'complete') {
        this._setStep('deploy');
      } else {
        showToast(`Deployment issue: ${(state.deployment_errors || []).join(', ')}`, 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = '&#128640; Deploy All Agents'; }
      }
    } catch (err) {
      showToast(`Deployment error: ${err.message}`, 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '&#128640; Deploy All Agents'; }
    }
  }

  _renderDeployStep() {
    const enabled = this._agents.filter(a => a.enabled);
    const industry = INDUSTRIES.find(i => i.value === this._selectedIndustry);
    const content = $('#onb-content');

    content.innerHTML = `
      <div class="glass-card" style="padding:0; overflow:hidden">
        <div style="background:linear-gradient(135deg, #22c55e, #059669); padding:2.5rem; text-align:center; color:#fff; position:relative; overflow:hidden">
          <!-- Success animation -->
          <div id="onb-deploy-confetti" style="position:absolute; top:0; left:0; right:0; bottom:0; pointer-events:none; overflow:hidden"></div>
          <div style="position:relative; z-index:1">
            <div style="font-size:4rem; margin-bottom:0.5rem; animation:onb-checkmark 0.6s ease-out">&#10003;</div>
            <h2 style="margin:0; font-size:1.5rem">Deployment Complete!</h2>
            <p style="margin:0.5rem 0 0; opacity:0.9; font-size:0.95rem">
              Successfully deployed <strong>${enabled.length}</strong> agent${enabled.length !== 1 ? 's' : ''} for
              <strong>${escapeHtml(this._wizard?.organization_name || '')}</strong>
            </p>
            ${industry && industry.badges.length > 0 ? `
              <div style="margin-top:0.75rem; display:flex; justify-content:center; flex-wrap:wrap; gap:0.35rem">
                ${industry.badges.map(b => `<span style="display:inline-block; padding:0.2rem 0.6rem; border-radius:20px; font-size:0.7rem; font-weight:600; background:rgba(255,255,255,0.2); color:#fff">${escapeHtml(b)}</span>`).join('')}
              </div>
            ` : ''}
          </div>
        </div>

        <div style="padding:2rem">
          <div style="padding:1rem; background:rgba(59,130,246,0.08); border:1px solid rgba(59,130,246,0.2); border-radius:8px; margin-bottom:1.5rem">
            <div style="font-weight:600; margin-bottom:0.25rem">What happens next?</div>
            <p style="margin:0; font-size:0.85rem; color:var(--text-muted)">
              Your agents are now active and configured with ${industry ? industry.title : 'your selected'} compliance guardrails.
              Visit the Agents page to manage them, check approval queues, or start chatting to test routing.
            </p>
          </div>

          <!-- Summary row -->
          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:0.75rem; margin-bottom:1.5rem">
            <div class="glass-card" style="padding:0.75rem; text-align:center">
              <div style="font-size:1.5rem; font-weight:700; color:var(--accent)">${enabled.length}</div>
              <div style="font-size:0.7rem; color:var(--text-muted)">Agents Live</div>
            </div>
            <div class="glass-card" style="padding:0.75rem; text-align:center">
              <div style="font-size:1.5rem; font-weight:700; color:var(--success, #22c55e)">${enabled.filter(a => this._gptLinks[a.id]).length}</div>
              <div style="font-size:0.7rem; color:var(--text-muted)">GPTs Linked</div>
            </div>
            <div class="glass-card" style="padding:0.75rem; text-align:center">
              <div style="font-size:1.5rem; font-weight:700; color:#8b5cf6">${industry ? industry.badges.length : 0}</div>
              <div style="font-size:0.7rem; color:var(--text-muted)">Guardrails</div>
            </div>
          </div>

          <!-- Action buttons -->
          <div style="display:flex; gap:0.75rem; justify-content:center; flex-wrap:wrap">
            <button class="btn btn-ghost" id="onb-new-wizard" style="padding:0.65rem 1.25rem">
              &#128260; Onboard Another
            </button>
            <button class="btn btn-ghost" id="onb-go-approvals" style="padding:0.65rem 1.25rem">
              &#128203; Review Approvals
            </button>
            <button class="btn btn-primary" id="onb-go-agents" style="padding:0.65rem 1.25rem">
              &#128101; View Agents
            </button>
          </div>
        </div>
      </div>
    `;

    // Confetti animation
    this._triggerConfetti();

    // Navigation
    $('#onb-go-agents').addEventListener('click', () => this.router.navigate('/agents'));
    $('#onb-go-approvals').addEventListener('click', () => this.router.navigate('/approvals'));
    $('#onb-new-wizard').addEventListener('click', () => {
      this._wizardId        = null;
      this._wizard          = null;
      this._agents          = [];
      this._discovery       = null;
      this._filter          = 'All';
      this._gptLinks        = {};
      this._selectedOrgType = null;
      this._selectedIndustry = null;
      this._sourceMode      = 'website';
      this._manualDepts     = '';
      this._setStep('orgtype');
      this._loadHistory();
    });
  }

  /** Simple confetti burst on deploy success */
  _triggerConfetti() {
    const container = $('#onb-deploy-confetti');
    if (!container) return;

    const colors = ['#f59e0b', '#8b5cf6', '#ec4899', '#3b82f6', '#22c55e', '#ef4444'];
    for (let i = 0; i < 30; i++) {
      const dot = document.createElement('div');
      const x = Math.random() * 100;
      const delay = Math.random() * 0.5;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = 4 + Math.random() * 6;
      dot.style.cssText = `
        position:absolute; bottom:0; left:${x}%; width:${size}px; height:${size}px;
        border-radius:50%; background:${color}; opacity:0;
        animation:onb-confetti 1.2s ${delay}s ease-out forwards;
      `;
      container.appendChild(dot);
    }

    // Remove confetti after animation
    setTimeout(() => { if (container) container.innerHTML = ''; }, 2000);
  }

  /* ═══════════════════ History ════════════════════════════════════ */

  async _loadHistory() {
    const el = $('#onb-history');
    if (!el) return;

    try {
      const wizards = await this.api._get('/api/onboarding/wizards?includeCompleted=true');

      if (!wizards.length) {
        el.innerHTML = '';
        return;
      }

      el.innerHTML = `
        <h3 style="margin-bottom:0.75rem">Previous Wizards</h3>
        ${wizards.map(w => `
          <div class="glass-card" style="padding:0.75rem 1rem; margin-bottom:0.5rem; display:flex; justify-content:space-between;
                      align-items:center; cursor:pointer; transition:border-color 0.2s; border:1px solid transparent"
               data-wiz-id="${escapeHtml(w.id)}"
               onmouseover="this.style.borderColor='var(--accent)'"
               onmouseout="this.style.borderColor='transparent'">
            <div>
              <strong>${escapeHtml(w.organization_name || 'Unknown')}</strong>
              <span class="badge" style="margin-left:0.5rem; font-size:0.65rem">${escapeHtml(w.step)}</span>
              ${w.organization_type ? `<span class="badge" style="margin-left:0.25rem; font-size:0.6rem; opacity:0.7">${escapeHtml(w.organization_type)}</span>` : ''}
            </div>
            <div style="font-size:0.8rem; color:var(--text-muted)">
              ${w.created_at ? new Date(w.created_at).toLocaleDateString() : ''}
            </div>
          </div>
        `).join('')}
      `;

      el.addEventListener('click', (e) => {
        const card = e.target.closest('[data-wiz-id]');
        if (card) this._resumeWizard(card.dataset.wizId);
      });
    } catch {
      el.innerHTML = '';
    }
  }

  async _resumeWizard(id) {
    try {
      const wizard = await this.api._get(`/api/onboarding/wizards/${id}`);
      this._wizardId = wizard.id;
      this._wizard   = wizard;

      // Restore org type and industry if stored
      if (wizard.organization_type) this._selectedOrgType = wizard.organization_type;
      if (wizard.industry)          this._selectedIndustry = wizard.industry;

      // Build agents from wizard departments
      this._agents = (wizard.departments || []).map(d => ({
        id: d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30),
        name: d.name,
        title: d.directorTitle || 'Director',
        enabled: d.enabled,
        domain: d.suggestedDomain || 'General',
        director: d.director,
        suggestedTemplate: d.suggestedTemplate || '',
        url: d.url,
      }));

      // Restore GPT links if stored
      if (wizard.gptLinks) this._gptLinks = { ...wizard.gptLinks };

      const history = $('#onb-history');
      if (history) history.style.display = 'none';

      if (wizard.step === 'complete')                                     this._setStep('deploy');
      else if (wizard.step === 'preview' || wizard.step === 'customization') this._setStep('review');
      else if (wizard.step === 'analysis' || wizard.step === 'template_match') this._setStep('select');
      else                                                                 this._setStep('source');
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  }
}
