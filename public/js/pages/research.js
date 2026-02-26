/**
 * AIOS V2 - Deep Research Page
 * Submit queries, watch 4-stage pipeline in real-time, view cited reports,
 * browse history, and push findings to agent knowledge bases.
 */

import { renderMarkdown } from '../components/markdown.js';
import { showToast } from '../components/toast.js';
import { escapeHtml, formatRelative, $ } from '../utils.js';

const STAGES = [
  { key: 'decomposition', label: 'Decompose', icon: '&#xe900;', desc: 'Breaking query into sub-questions' },
  { key: 'retrieval',     label: 'Retrieve',  icon: '&#xe901;', desc: 'Searching RAG + web sources' },
  { key: 'scoring',       label: 'Score',     icon: '&#xe902;', desc: 'Evaluating source credibility' },
  { key: 'synthesis',     label: 'Synthesize', icon: '&#xe903;', desc: 'Generating cited report' },
];

const CREDIBILITY_TIERS = {
  PRIMARY_SOURCE: { label: 'Primary', color: 'var(--accent-green)', class: 'tier-primary' },
  AUTHORITATIVE:  { label: 'Authoritative', color: 'var(--accent-blue)', class: 'tier-authoritative' },
  SECONDARY:      { label: 'Secondary', color: 'var(--accent-orange)', class: 'tier-secondary' },
  UNVERIFIED:     { label: 'Unverified', color: 'var(--text-muted)', class: 'tier-unverified' },
  FLAGGED:        { label: 'Flagged', color: 'var(--accent-red)', class: 'tier-flagged' },
};

const ICONS = {
  research: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6"/><path d="M21 21l-4.35-4.35"/><path d="M11 8v6M8 11h6"/></svg>`,
  send: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 2L8 10"/><path d="M16 2l-5 14-3-6-6-3 14-5z"/></svg>`,
  clock: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="7" r="5.5"/><path d="M7 4v3l2 1.5"/></svg>`,
  source: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 2h10v10H2z"/><path d="M5 5h4M5 7h4M5 9h2"/></svg>`,
  claim: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 1l6 3v4c0 3-2.5 5-6 6-3.5-1-6-3-6-6V4l6-3z"/></svg>`,
  contradiction: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 1L1 13h12L7 1z"/><path d="M7 5v4M7 11v.5"/></svg>`,
  push: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 2v8M4 5l3-3 3 3"/><path d="M2 10v2h10v-2"/></svg>`,
  cancel: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3l8 8M11 3l-8 8"/></svg>`,
  expand: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 3l4 4-4 4"/></svg>`,
  check: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8l4 4 6-7"/></svg>`,
  spinner: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" class="spin"><path d="M8 2a6 6 0 105.3 3.2"/></svg>`,
  link: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 7l2-2"/><path d="M7 3l1.5-1.5a2 2 0 012.8 2.8L9.8 5.8"/><path d="M5 9L3.5 10.5a2 2 0 01-2.8-2.8L2.2 6.2"/></svg>`,
};

export class ResearchPage {
  constructor(app) {
    this.state = app.state;
    this.api = app.api;
    this.router = app.router;
    this.socket = app.socket;
    this._unsubs = [];
    this._socketListeners = [];
    this._activeJobId = null;
    this._stageState = {};
    this._jobs = [];
    this._pollInterval = null;
    this._viewingJobId = null;
  }

  render(mount) {
    mount.innerHTML = `
      <div class="page page-research">
        <div class="page-gradient-header" style="background: linear-gradient(135deg, #ec4899, #8b5cf6, #6366f1)">
          <div class="page-header-content">
            <h1 class="page-title">
              <span class="page-title-icon">${ICONS.research}</span>
              Deep Research
            </h1>
            <p class="page-subtitle">Multi-stage research pipeline with source scoring, claim extraction, and cited synthesis</p>
          </div>
        </div>

        <!-- Queue Summary -->
        <section class="research-stats" id="research-stats"></section>

        <!-- Submit Form -->
        <section class="research-submit glass-card" id="research-submit">
          <div class="submit-row">
            <div class="submit-input-wrap">
              <textarea class="input research-input" id="research-query"
                placeholder="Ask a research question... e.g., 'What are the zoning requirements for mixed-use development in Ward 7?'"
                rows="2"></textarea>
            </div>
            <button class="btn btn-primary btn-submit" id="btn-submit" title="Submit research job">
              ${ICONS.send}
              <span>Research</span>
            </button>
          </div>
        </section>

        <!-- Active Pipeline -->
        <section class="pipeline-section" id="pipeline-section" style="display:none">
          <div class="pipeline-header">
            <h2 class="section-title">Pipeline Progress</h2>
            <button class="btn btn-sm btn-ghost" id="btn-cancel-job" title="Cancel job">${ICONS.cancel} Cancel</button>
          </div>
          <div class="pipeline-query" id="pipeline-query"></div>
          <div class="pipeline-stages" id="pipeline-stages"></div>
          <div class="pipeline-result" id="pipeline-result"></div>
        </section>

        <!-- Research History -->
        <section class="history-section">
          <div class="section-header-row">
            <h2 class="section-title">Research History</h2>
            <button class="btn btn-sm btn-ghost" id="btn-refresh-history">Refresh</button>
          </div>
          <div class="history-list" id="history-list">
            <div class="skeleton-block" style="height:80px"></div>
          </div>
        </section>
      </div>
    `;

    this._bindEvents(mount);
    this._setupSocket();
    this._loadHistory();
    this._loadQueueSummary();

    return () => this._cleanup();
  }

  // ─── Event Binding ─────────────────────────────────────

  _bindEvents(mount) {
    const submitBtn = $('#btn-submit', mount);
    const queryInput = $('#research-query', mount);
    const cancelBtn = $('#btn-cancel-job', mount);
    const refreshBtn = $('#btn-refresh-history', mount);

    submitBtn?.addEventListener('click', () => this._submitJob());
    queryInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._submitJob();
      }
    });
    cancelBtn?.addEventListener('click', () => this._cancelActiveJob());
    refreshBtn?.addEventListener('click', () => this._loadHistory());

    // Delegate clicks in history list
    mount.addEventListener('click', (e) => {
      const viewBtn = e.target.closest('[data-action="view-result"]');
      if (viewBtn) {
        this._viewResult(viewBtn.dataset.jobId);
        return;
      }
      const expandBtn = e.target.closest('[data-action="toggle-sources"]');
      if (expandBtn) {
        this._toggleSources(expandBtn.dataset.jobId);
        return;
      }
    });
  }

  // ─── Socket.io Real-Time ───────────────────────────────

  _setupSocket() {
    if (!this.socket) return;

    const on = (event, handler) => {
      this.socket.on(event, handler);
      this._socketListeners.push({ event, handler });
    };

    on('research:progress', (data) => {
      if (data.jobId !== this._activeJobId) return;
      this._updateStage(data.stage, data.progress);
    });

    on('research:completed', (data) => {
      if (data.jobId !== this._activeJobId) return;
      this._onJobCompleted(data);
    });

    on('research:failed', (data) => {
      if (data.jobId !== this._activeJobId) return;
      this._onJobFailed(data);
    });

    on('research:cancelled', (data) => {
      if (data.jobId !== this._activeJobId) return;
      this._onJobCancelled();
    });
  }

  _joinJobRoom(jobId) {
    if (this.socket) {
      this.socket.emit('join-room', `research:${jobId}`);
    }
  }

  _leaveJobRoom(jobId) {
    if (this.socket && jobId) {
      this.socket.emit('leave-room', `research:${jobId}`);
    }
  }

  // ─── Submit ────────────────────────────────────────────

  async _submitJob() {
    const input = document.getElementById('research-query');
    const query = input?.value?.trim();
    if (!query) {
      showToast('Enter a research query', 'warning');
      return;
    }

    const submitBtn = document.getElementById('btn-submit');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `${ICONS.spinner} <span>Submitting...</span>`;

    try {
      const job = await this.api._post('/api/research/jobs', { query });
      input.value = '';
      this._activeJobId = job.id;
      this._stageState = {};
      this._joinJobRoom(job.id);
      this._showPipeline(job);
      showToast('Research job submitted', 'success');
      // Start polling as fallback for socket
      this._startPolling(job.id);
    } catch (err) {
      showToast(`Submit failed: ${err.message}`, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `${ICONS.send} <span>Research</span>`;
    }
  }

  // ─── Pipeline Visualization ────────────────────────────

  _showPipeline(job) {
    const section = document.getElementById('pipeline-section');
    const queryEl = document.getElementById('pipeline-query');
    const stagesEl = document.getElementById('pipeline-stages');
    const resultEl = document.getElementById('pipeline-result');

    section.style.display = '';
    queryEl.innerHTML = `<span class="pipeline-query-label">Researching:</span> <span class="pipeline-query-text">${escapeHtml(job.query)}</span>`;
    resultEl.innerHTML = '';

    stagesEl.innerHTML = STAGES.map((s, i) => `
      <div class="stage-card" id="stage-${s.key}" data-stage="${s.key}">
        <div class="stage-indicator">
          <div class="stage-dot" id="dot-${s.key}">
            <span class="stage-number">${i + 1}</span>
          </div>
          ${i < STAGES.length - 1 ? '<div class="stage-connector"></div>' : ''}
        </div>
        <div class="stage-info">
          <div class="stage-label">${s.label}</div>
          <div class="stage-desc" id="desc-${s.key}">${s.desc}</div>
        </div>
        <div class="stage-status" id="status-${s.key}">
          <span class="stage-badge stage-pending">Waiting</span>
        </div>
      </div>
    `).join('');
  }

  _updateStage(stage, progress) {
    this._stageState[stage] = progress;

    const dot = document.getElementById(`dot-${stage}`);
    const statusEl = document.getElementById(`status-${stage}`);
    const card = document.getElementById(`stage-${stage}`);

    if (!dot || !statusEl || !card) return;

    if (progress === 0) {
      // In progress
      dot.classList.add('stage-active');
      dot.innerHTML = ICONS.spinner;
      statusEl.innerHTML = '<span class="stage-badge stage-running">Running</span>';
      card.classList.add('stage-card--active');
    } else if (progress >= 100) {
      // Complete
      dot.classList.remove('stage-active');
      dot.classList.add('stage-complete');
      dot.innerHTML = ICONS.check;
      statusEl.innerHTML = '<span class="stage-badge stage-done">Done</span>';
      card.classList.remove('stage-card--active');
      card.classList.add('stage-card--complete');
    }
  }

  async _onJobCompleted(data) {
    this._stopPolling();
    // Mark all stages complete
    STAGES.forEach(s => this._updateStage(s.key, 100));

    try {
      const [result, sources] = await Promise.all([
        this.api._get(`/api/research/jobs/${this._activeJobId}/result`),
        this.api._get(`/api/research/jobs/${this._activeJobId}/sources`),
      ]);
      this._renderResult(result, sources, data.confidenceScore);
    } catch (err) {
      this._renderResultError('Failed to load results: ' + err.message);
    }

    this._leaveJobRoom(this._activeJobId);
    this._activeJobId = null;
    this._loadHistory();
    this._loadQueueSummary();
  }

  _onJobFailed(data) {
    this._stopPolling();
    const resultEl = document.getElementById('pipeline-result');
    if (resultEl) {
      resultEl.innerHTML = `
        <div class="result-error glass-card">
          <h3>Research Failed</h3>
          <p>${escapeHtml(data.error || 'Unknown error')}</p>
        </div>
      `;
    }
    this._leaveJobRoom(this._activeJobId);
    this._activeJobId = null;
    this._loadHistory();
    this._loadQueueSummary();
  }

  _onJobCancelled() {
    this._stopPolling();
    const section = document.getElementById('pipeline-section');
    if (section) section.style.display = 'none';
    showToast('Research job cancelled', 'info');
    this._leaveJobRoom(this._activeJobId);
    this._activeJobId = null;
    this._loadHistory();
    this._loadQueueSummary();
  }

  async _cancelActiveJob() {
    if (!this._activeJobId) return;
    try {
      await this.api._post(`/api/research/jobs/${this._activeJobId}/cancel`);
    } catch (err) {
      showToast(`Cancel failed: ${err.message}`, 'error');
    }
  }

  // ─── Polling Fallback ──────────────────────────────────

  _startPolling(jobId) {
    this._stopPolling();
    this._pollInterval = setInterval(async () => {
      try {
        const job = await this.api._get(`/api/research/jobs/${jobId}`);
        if (!job) return;

        // Update stages from server state
        if (job.current_stage && job.stage_progress !== undefined) {
          const stageIdx = STAGES.findIndex(s => s.key === job.current_stage);
          // Mark earlier stages complete
          for (let i = 0; i < stageIdx; i++) {
            if (!this._stageState[STAGES[i].key] || this._stageState[STAGES[i].key] < 100) {
              this._updateStage(STAGES[i].key, 100);
            }
          }
          this._updateStage(job.current_stage, job.stage_progress);
        }

        if (job.status === 'COMPLETED') {
          this._onJobCompleted({ jobId, confidenceScore: job.confidence_score });
        } else if (job.status === 'FAILED') {
          this._onJobFailed({ jobId, error: job.error_message });
        } else if (job.status === 'CANCELLED') {
          this._onJobCancelled();
        }
      } catch { /* ignore polling errors */ }
    }, 2000);
  }

  _stopPolling() {
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
  }

  // ─── Result Rendering ─────────────────────────────────

  _renderResult(result, sources, confidenceScore) {
    const resultEl = document.getElementById('pipeline-result');
    if (!resultEl) return;

    const confidence = confidenceScore || result?.confidence_score || 0;
    const confidencePct = Math.round(confidence * 100);
    const confidenceClass = confidencePct >= 80 ? 'confidence-high' : confidencePct >= 50 ? 'confidence-med' : 'confidence-low';

    const claims = result?.claims || [];
    const contradictions = claims.filter(c => c.contradictionFlag);

    resultEl.innerHTML = `
      <div class="result-container">
        <!-- Confidence Bar -->
        <div class="result-meta glass-card">
          <div class="meta-row">
            <div class="meta-item">
              <span class="meta-label">Confidence</span>
              <div class="confidence-bar-wrap">
                <div class="confidence-bar ${confidenceClass}" style="width:${confidencePct}%"></div>
              </div>
              <span class="confidence-value ${confidenceClass}">${confidencePct}%</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Sources</span>
              <span class="meta-value">${sources?.length || 0}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Claims</span>
              <span class="meta-value">${claims.length}</span>
            </div>
            ${contradictions.length > 0 ? `
              <div class="meta-item meta-warning">
                <span class="meta-label">${ICONS.contradiction} Contradictions</span>
                <span class="meta-value">${contradictions.length}</span>
              </div>
            ` : ''}
            <div class="meta-item">
              <span class="meta-label">Tokens</span>
              <span class="meta-value">${(result?.token_usage?.totalTokens || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <!-- Synthesis Report -->
        <div class="result-report glass-card">
          <div class="report-content">
            ${renderMarkdown(result?.synthesis || '_No synthesis available._')}
          </div>
        </div>

        <!-- Sources Panel -->
        ${sources && sources.length > 0 ? `
          <div class="result-sources glass-card">
            <h3 class="sources-title">${ICONS.source} Sources (${sources.length})</h3>
            <div class="sources-grid">
              ${sources.map((s, i) => this._renderSourceCard(s, i)).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Claims Panel -->
        ${claims.length > 0 ? `
          <div class="result-claims glass-card">
            <h3 class="claims-title">${ICONS.claim} Extracted Claims (${claims.length})</h3>
            <div class="claims-list">
              ${claims.map(c => this._renderClaimCard(c)).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  _renderSourceCard(source, index) {
    const tier = CREDIBILITY_TIERS[source.credibility_tier || source.credibilityTier] || CREDIBILITY_TIERS.UNVERIFIED;
    const composite = Math.round((source.composite_score || source.compositeScore || 0) * 100);
    const domain = this._extractDomain(source.url);

    return `
      <div class="source-card">
        <div class="source-rank">#${index + 1}</div>
        <div class="source-body">
          <div class="source-header">
            ${source.url ? `<a class="source-link" href="${escapeHtml(source.url)}" target="_blank" rel="noopener">${escapeHtml(source.title || domain || 'Source')}</a>` : `<span class="source-title">${escapeHtml(source.title || 'Untitled')}</span>`}
            <span class="source-tier ${tier.class}">${tier.label}</span>
          </div>
          <div class="source-url">${domain ? escapeHtml(domain) : ''}</div>
          ${source.content_preview || source.contentPreview ? `<div class="source-preview">${escapeHtml((source.content_preview || source.contentPreview || '').slice(0, 200))}...</div>` : ''}
          <div class="source-scores">
            <span class="score-chip" title="Composite score">Score: ${composite}%</span>
            ${source.domain_authority || source.domainAuthority ? `<span class="score-chip" title="Domain authority">DA: ${source.domain_authority || source.domainAuthority}</span>` : ''}
            <span class="score-chip" title="Retrieval method">${escapeHtml(source.retrieval_method || source.retrievalMethod || 'rag')}</span>
          </div>
        </div>
      </div>
    `;
  }

  _renderClaimCard(claim) {
    const confidence = Math.round((claim.confidenceScore || 0) * 100);
    const isContradicted = claim.contradictionFlag;

    return `
      <div class="claim-card ${isContradicted ? 'claim-contradicted' : ''}">
        <div class="claim-text">${escapeHtml(claim.text)}</div>
        <div class="claim-meta">
          <span class="claim-confidence" title="Claim confidence">${confidence}%</span>
          ${isContradicted ? `<span class="claim-flag">${ICONS.contradiction} Contradicted</span>` : ''}
          ${claim.supportStrength ? `<span class="claim-support">Support: ${Math.round(claim.supportStrength * 100)}%</span>` : ''}
        </div>
      </div>
    `;
  }

  _renderResultError(msg) {
    const resultEl = document.getElementById('pipeline-result');
    if (resultEl) {
      resultEl.innerHTML = `<div class="result-error glass-card"><p>${escapeHtml(msg)}</p></div>`;
    }
  }

  // ─── Queue Summary ─────────────────────────────────────

  async _loadQueueSummary() {
    try {
      const summary = await this.api._get('/api/research/queue/summary');
      const el = document.getElementById('research-stats');
      if (!el) return;

      el.innerHTML = `
        <div class="stat-card glass-card">
          <div class="stat-value">${summary.total || 0}</div>
          <div class="stat-label">Total Jobs</div>
        </div>
        <div class="stat-card glass-card">
          <div class="stat-value stat-processing">${(summary.QUEUED || 0) + (summary.PROCESSING || 0)}</div>
          <div class="stat-label">Active</div>
        </div>
        <div class="stat-card glass-card">
          <div class="stat-value stat-completed">${summary.COMPLETED || 0}</div>
          <div class="stat-label">Completed</div>
        </div>
        <div class="stat-card glass-card">
          <div class="stat-value stat-failed">${summary.FAILED || 0}</div>
          <div class="stat-label">Failed</div>
        </div>
      `;
    } catch { /* ignore */ }
  }

  // ─── History ───────────────────────────────────────────

  async _loadHistory() {
    try {
      this._jobs = await this.api._get('/api/research/jobs');
      this._renderHistory();
    } catch (err) {
      const el = document.getElementById('history-list');
      if (el) el.innerHTML = `<p class="text-muted">Failed to load history: ${escapeHtml(err.message)}</p>`;
    }
  }

  _renderHistory() {
    const el = document.getElementById('history-list');
    if (!el) return;

    if (!this._jobs || this._jobs.length === 0) {
      el.innerHTML = `
        <div class="empty-state">
          <p>No research jobs yet. Submit a query above to get started.</p>
        </div>
      `;
      return;
    }

    el.innerHTML = this._jobs.map(job => {
      const statusClass = `status-${(job.status || 'QUEUED').toLowerCase()}`;
      const confidence = job.confidence_score ? Math.round(job.confidence_score * 100) : null;
      const time = job.created_at ? formatRelative(job.created_at) : '';
      const duration = this._calcDuration(job);

      return `
        <div class="history-card glass-card ${this._viewingJobId === job.id ? 'history-card--active' : ''}">
          <div class="history-main">
            <div class="history-query">${escapeHtml(job.query)}</div>
            <div class="history-meta">
              <span class="history-status ${statusClass}">${job.status}</span>
              ${confidence !== null ? `<span class="history-confidence">Confidence: ${confidence}%</span>` : ''}
              ${job.source_count ? `<span class="history-sources">${job.source_count} sources</span>` : ''}
              ${job.has_contradictions ? `<span class="history-contradictions">${ICONS.contradiction} Has contradictions</span>` : ''}
              <span class="history-time">${ICONS.clock} ${time}</span>
              ${duration ? `<span class="history-duration">${duration}</span>` : ''}
            </div>
          </div>
          <div class="history-actions">
            ${job.status === 'COMPLETED' ? `
              <button class="btn btn-sm btn-primary" data-action="view-result" data-job-id="${job.id}">View Report</button>
            ` : ''}
            ${job.status === 'PROCESSING' || job.status === 'QUEUED' ? `
              <span class="processing-indicator">${ICONS.spinner} Processing...</span>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // ─── View Historical Result ────────────────────────────

  async _viewResult(jobId) {
    this._viewingJobId = jobId;
    this._renderHistory(); // Highlight active

    // Show pipeline section for result display
    const section = document.getElementById('pipeline-section');
    const queryEl = document.getElementById('pipeline-query');
    const stagesEl = document.getElementById('pipeline-stages');
    const cancelBtn = document.getElementById('btn-cancel-job');

    const job = this._jobs.find(j => j.id === jobId);

    section.style.display = '';
    cancelBtn.style.display = 'none';
    queryEl.innerHTML = `<span class="pipeline-query-label">Research Report:</span> <span class="pipeline-query-text">${escapeHtml(job?.query || '')}</span>`;
    stagesEl.innerHTML = ''; // No pipeline stages for historical view

    // Show completed stage indicators
    stagesEl.innerHTML = STAGES.map((s, i) => `
      <div class="stage-card stage-card--complete">
        <div class="stage-indicator">
          <div class="stage-dot stage-complete">${ICONS.check}</div>
          ${i < STAGES.length - 1 ? '<div class="stage-connector stage-connector--complete"></div>' : ''}
        </div>
        <div class="stage-info">
          <div class="stage-label">${s.label}</div>
        </div>
        <div class="stage-status"><span class="stage-badge stage-done">Done</span></div>
      </div>
    `).join('');

    try {
      const [result, sources] = await Promise.all([
        this.api._get(`/api/research/jobs/${jobId}/result`),
        this.api._get(`/api/research/jobs/${jobId}/sources`),
      ]);
      this._renderResult(result, sources, job?.confidence_score);

      // Scroll to pipeline section
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      this._renderResultError('Failed to load result: ' + err.message);
    }
  }

  _toggleSources(jobId) {
    const el = document.querySelector(`[data-sources-for="${jobId}"]`);
    if (el) el.classList.toggle('sources-expanded');
  }

  // ─── Helpers ───────────────────────────────────────────

  _extractDomain(url) {
    if (!url) return '';
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url.slice(0, 40);
    }
  }

  _calcDuration(job) {
    if (!job.created_at || !job.completed_at) return null;
    const ms = new Date(job.completed_at) - new Date(job.created_at);
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }

  // ─── Cleanup ───────────────────────────────────────────

  _cleanup() {
    this._stopPolling();
    this._unsubs.forEach(fn => fn());
    this._socketListeners.forEach(({ event, handler }) => {
      this.socket?.off(event, handler);
    });
    if (this._activeJobId) {
      this._leaveJobRoom(this._activeJobId);
    }
    this._socketListeners = [];
    this._unsubs = [];
  }
}
