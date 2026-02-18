/**
 * AIOS V2 - Memory Page (V1-Level Polish)
 * Gradient header, stat cards, file browser with metadata, markdown viewer
 * with edit/delete, create-file modal, and enhanced search results.
 */

import { renderMarkdown } from '../components/markdown.js';
import { showToast } from '../components/toast.js';
import { escapeHtml, debounce, $ } from '../utils.js';

const IDENTITY_FILES = ['SOUL.md', 'IDENTITY.md', 'PERSONALITY.md', 'VALUES.md', 'GOALS.md'];

/* ---------- SVG Icons ---------- */

const ICONS = {
  brain: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A5.5 5.5 0 0 0 4 7.5c0 1.58.67 3 1.73 4.01"/><path d="M4.73 11.51A5.5 5.5 0 0 0 9.5 22h1"/><path d="M14.5 2A5.5 5.5 0 0 1 20 7.5c0 1.58-.67 3-1.73 4.01"/><path d="M19.27 11.51A5.5 5.5 0 0 1 14.5 22h-1"/><path d="M12 2v20"/></svg>`,
  file: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5L9 1z"/><polyline points="9,1 9,5 13,5"/></svg>`,
  star: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" stroke="none"><path d="M8 1l2.1 4.3 4.7.7-3.4 3.3.8 4.7L8 11.8 3.8 14l.8-4.7L1.2 6l4.7-.7L8 1z"/></svg>`,
  search: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="6.5" cy="6.5" r="5"/><line x1="10" y1="10" x2="15" y2="15"/></svg>`,
  edit: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 1.5l2.5 2.5L4.5 12H2v-2.5L10 1.5z"/></svg>`,
  eye: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z"/><circle cx="7" cy="7" r="2"/></svg>`,
  trash: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,4 12,4"/><path d="M5 4V2.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5V4"/><path d="M10.5 4v8a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V4"/></svg>`,
  plus: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="7" y1="2" x2="7" y2="12"/><line x1="2" y1="7" x2="12" y2="7"/></svg>`,
  fileTotal: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-5-5z"/><polyline points="11,2 11,7 16,7"/></svg>`,
  identity: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="7" r="4"/><path d="M3 18c0-3.3 3.1-6 7-6s7 2.7 7 6"/></svg>`,
  size: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M7 10h6M10 7v6"/></svg>`,
  close: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg>`,
};

/* ---------- Helpers ---------- */

/**
 * Format a file size in bytes to a human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
function formatFileSize(bytes) {
  if (bytes == null || isNaN(bytes)) return '--';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format a date string / timestamp to a relative or short date.
 * @param {string|number|undefined} ts
 * @returns {string}
 */
function formatDate(ts) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    const now = Date.now();
    const diffMs = now - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

/**
 * Highlight occurrences of query terms in a text snippet.
 * @param {string} text
 * @param {string} query
 * @returns {string} HTML with <mark> highlights
 */
function highlightMatches(text, query) {
  if (!query || !text) return escapeHtml(text || '');
  const escaped = escapeHtml(text);
  const terms = query.split(/\s+/).filter(Boolean);
  let result = escaped;
  for (const term of terms) {
    const re = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    result = result.replace(re, '<mark class="search-highlight">$1</mark>');
  }
  return result;
}

/* ================================================================
   MemoryPage Class
   ================================================================ */

export class MemoryPage {
  /**
   * @param {Object} app - App instance with state, api, router
   */
  constructor(app) {
    this.state = app.state;
    this.api = app.api;
    this.router = app.router;
    this._unsubs = [];
    this._selectedFile = null;
    this._editMode = false;
    this._rawContent = '';
    this._files = [];
    this._searchQuery = '';
  }

  /* ─────────── Render ─────────── */

  /**
   * Render the memory page into the mount element.
   * @param {HTMLElement} mount
   * @returns {Function} Cleanup function
   */
  render(mount) {
    mount.innerHTML = `
      <div class="page page-memory">

        <!-- ===== Gradient Header ===== -->
        <div class="page-gradient-header" style="background: var(--gradient-memory)">
          <div class="page-header-content">
            <h1 class="page-title">
              <span class="page-title-icon">${ICONS.brain}</span>
              Memory &amp; Knowledge
            </h1>
            <p class="page-subtitle">Browse, edit, and search agent memory files and identity documents</p>
          </div>
        </div>

        <!-- ===== Stat Cards ===== -->
        <section class="stat-grid" id="memory-stats" style="margin-bottom: var(--space-6)">
          ${this._renderStatsSkeleton()}
        </section>

        <!-- ===== Search Bar ===== -->
        <div class="memory-search" style="margin-bottom: var(--space-6)">
          <div class="memory-search-wrapper">
            <span class="memory-search-icon">${ICONS.search}</span>
            <input type="text" class="memory-search-input" id="memory-search"
                   placeholder="Search across all memory files..." autocomplete="off" />
          </div>
        </div>

        <!-- ===== Main Layout: File List + Viewer ===== -->
        <div class="memory-layout">

          <!-- File List Sidebar -->
          <aside class="file-list" id="memory-file-list">
            <div class="file-list-header">
              <span class="file-list-title">Files</span>
              <button class="btn btn-sm btn-outline" id="memory-create-btn" title="Create new file">
                ${ICONS.plus} New
              </button>
            </div>
            <div class="file-list-items" id="file-list-items">
              <div class="loader-overlay" style="min-height:120px"><div class="spinner"></div></div>
            </div>
          </aside>

          <!-- Content Viewer -->
          <main class="memory-content" id="memory-viewer">
            <div class="memory-content-header" id="viewer-header" style="display: none;">
              <div class="memory-content-title">
                <span id="viewer-filename"></span>
                <span class="memory-content-path" id="viewer-filepath"></span>
              </div>
              <div class="memory-content-actions">
                <button class="btn btn-sm btn-ghost" id="viewer-edit-toggle" title="Toggle edit mode">
                  <span id="edit-toggle-icon">${ICONS.edit}</span>
                  <span id="edit-toggle-label">Edit</span>
                </button>
                <button class="btn btn-sm btn-ghost" id="viewer-delete-btn" title="Delete file" style="color: var(--accent-red)">
                  ${ICONS.trash}
                </button>
              </div>
            </div>

            <!-- Rendered markdown view -->
            <div class="markdown-viewer" id="viewer-content">
              <div class="empty-state">
                <svg class="empty-state-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
                <p class="empty-state-title">Select a file</p>
                <p class="empty-state-desc">Choose a memory file from the sidebar to view its contents.</p>
              </div>
            </div>

            <!-- Editor (hidden by default) -->
            <div class="memory-editor" id="viewer-edit" style="display: none;">
              <textarea class="memory-editor-textarea" id="memory-edit-textarea"
                        placeholder="Write markdown content..."></textarea>
              <div class="memory-editor-footer">
                <span class="memory-editor-meta" id="editor-meta"></span>
                <div style="display:flex;gap:var(--space-2)">
                  <button class="btn btn-sm btn-ghost" id="edit-cancel">Cancel</button>
                  <button class="btn btn-sm btn-primary" id="edit-save">Save Changes</button>
                </div>
              </div>
            </div>
          </main>

        </div>

        <!-- ===== Search Results ===== -->
        <div class="memory-search-results glass-card" id="memory-search-results" style="display: none; margin-top: var(--space-6)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-4)">
            <h3 style="margin:0;color:var(--text-white);font-size:var(--font-size-md)">
              ${ICONS.search} Search Results
            </h3>
            <button class="btn btn-sm btn-ghost" id="search-results-close">${ICONS.close} Close</button>
          </div>
          <div id="search-results-list"></div>
        </div>

        <!-- ===== Create File Modal ===== -->
        <div class="modal-backdrop" id="create-modal" style="display: none;">
          <div class="modal modal--sm">
            <div class="modal-header">
              <span class="modal-title">Create Memory File</span>
              <button class="modal-close" id="create-modal-close">${ICONS.close}</button>
            </div>
            <div class="modal-body">
              <label class="input-label">Filename</label>
              <input type="text" class="input" id="create-filename-input"
                     placeholder="e.g. NOTES.md" autocomplete="off" />
              <p style="margin-top:var(--space-2);font-size:var(--font-size-xs);color:var(--text-muted)">
                Use .md extension for markdown files. Identity files (SOUL.md, IDENTITY.md, etc.) receive special treatment.
              </p>
            </div>
            <div class="modal-footer">
              <button class="btn btn-sm btn-ghost" id="create-cancel">Cancel</button>
              <button class="btn btn-sm btn-primary" id="create-confirm">Create File</button>
            </div>
          </div>
        </div>

        <!-- ===== Delete Confirmation Modal ===== -->
        <div class="modal-backdrop" id="delete-modal" style="display: none;">
          <div class="modal modal--sm">
            <div class="modal-header">
              <span class="modal-title" style="color: var(--accent-red)">Delete File</span>
              <button class="modal-close" id="delete-modal-close">${ICONS.close}</button>
            </div>
            <div class="modal-body">
              <p style="color:var(--text-primary)">Are you sure you want to delete <strong id="delete-filename-display" style="color:var(--text-white)"></strong>?</p>
              <p style="margin-top:var(--space-2);font-size:var(--font-size-sm);color:var(--accent-red)">This action cannot be undone.</p>
            </div>
            <div class="modal-footer">
              <button class="btn btn-sm btn-ghost" id="delete-cancel">Cancel</button>
              <button class="btn btn-sm btn-danger" id="delete-confirm">Delete</button>
            </div>
          </div>
        </div>

      </div>
    `;

    this._bindEvents(mount);
    this._fetchFiles();

    // Subscribe to state changes
    const unsubFiles = this.state.on('memoryFiles', (files) => {
      this._files = this._normalizeFiles(files);
      this._renderFileList(this._files);
      this._renderStats(this._files);
    });
    this._unsubs.push(unsubFiles);

    return () => this._cleanup();
  }

  /* ─────────── Event Binding ─────────── */

  /**
   * Bind all event handlers.
   * @private
   * @param {HTMLElement} mount
   */
  _bindEvents(mount) {
    // Search
    const searchInput = $('#memory-search', mount);
    if (searchInput) {
      const debouncedSearch = debounce((query) => this._search(query), 300);
      searchInput.addEventListener('input', () => {
        const q = searchInput.value.trim();
        this._searchQuery = q;
        if (q.length >= 2) {
          debouncedSearch(q);
        } else {
          const resultsEl = document.getElementById('memory-search-results');
          if (resultsEl) resultsEl.style.display = 'none';
        }
      });
    }

    // Close search results
    const closeSearchBtn = $('#search-results-close', mount);
    if (closeSearchBtn) {
      closeSearchBtn.addEventListener('click', () => {
        const resultsEl = document.getElementById('memory-search-results');
        if (resultsEl) resultsEl.style.display = 'none';
      });
    }

    // Edit toggle
    const editToggle = $('#viewer-edit-toggle', mount);
    if (editToggle) editToggle.addEventListener('click', () => this._toggleEdit());

    // Cancel edit
    const cancelBtn = $('#edit-cancel', mount);
    if (cancelBtn) cancelBtn.addEventListener('click', () => this._toggleEdit(false));

    // Save edit
    const saveBtn = $('#edit-save', mount);
    if (saveBtn) saveBtn.addEventListener('click', () => this._saveFile());

    // Editor meta update (character count)
    const textarea = $('#memory-edit-textarea', mount);
    if (textarea) {
      textarea.addEventListener('input', () => this._updateEditorMeta());
    }

    // Delete button
    const deleteBtn = $('#viewer-delete-btn', mount);
    if (deleteBtn) deleteBtn.addEventListener('click', () => this._showDeleteModal());

    // Create file button
    const createBtn = $('#memory-create-btn', mount);
    if (createBtn) createBtn.addEventListener('click', () => this._showCreateModal());

    // Create modal
    this._bindModalEvents(mount, 'create');
    this._bindModalEvents(mount, 'delete');

    // Create confirm
    const createConfirm = $('#create-confirm', mount);
    if (createConfirm) createConfirm.addEventListener('click', () => this._createFile());

    // Create on Enter key
    const filenameInput = $('#create-filename-input', mount);
    if (filenameInput) {
      filenameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this._createFile();
      });
    }

    // Delete confirm
    const deleteConfirm = $('#delete-confirm', mount);
    if (deleteConfirm) deleteConfirm.addEventListener('click', () => this._deleteFile());
  }

  /**
   * Bind common modal open/close events.
   * @private
   */
  _bindModalEvents(mount, prefix) {
    const backdrop = $(`#${prefix}-modal`, mount);
    const closeBtn = $(`#${prefix}-modal-close`, mount);
    const cancelBtn = $(`#${prefix}-cancel`, mount);

    const hide = () => { if (backdrop) backdrop.style.display = 'none'; };

    if (closeBtn) closeBtn.addEventListener('click', hide);
    if (cancelBtn) cancelBtn.addEventListener('click', hide);
    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) hide();
      });
    }
  }

  /* ─────────── Data Fetching ─────────── */

  /**
   * Fetch memory files from the API.
   * @private
   */
  async _fetchFiles() {
    try {
      await this.api.fetchMemoryFiles();
    } catch (err) {
      const listEl = document.getElementById('file-list-items');
      if (listEl) {
        listEl.innerHTML = `
          <div class="empty-state" style="padding:var(--space-6)">
            <p class="error-text">Failed to load: ${escapeHtml(err.message)}</p>
          </div>`;
      }
    }
  }

  /**
   * Normalize file data (could be strings or objects).
   * @private
   * @param {Array} files
   * @returns {Array}
   */
  _normalizeFiles(files) {
    if (!files) return [];
    return files.map((f) => {
      if (typeof f === 'string') return { name: f, filename: f };
      return { ...f, name: f.name || f.filename };
    });
  }

  /* ─────────── Stats Rendering ─────────── */

  /**
   * Render loading skeleton for stat cards.
   * @private
   * @returns {string}
   */
  _renderStatsSkeleton() {
    return `
      <div class="stat-card glass-card"><div class="skeleton skeleton-text--lg"></div><div class="skeleton skeleton-text" style="width:50%"></div></div>
      <div class="stat-card glass-card"><div class="skeleton skeleton-text--lg"></div><div class="skeleton skeleton-text" style="width:50%"></div></div>
      <div class="stat-card glass-card"><div class="skeleton skeleton-text--lg"></div><div class="skeleton skeleton-text" style="width:50%"></div></div>
    `;
  }

  /**
   * Render the 3 stat cards.
   * @private
   * @param {Array} files
   */
  _renderStats(files) {
    const container = document.getElementById('memory-stats');
    if (!container) return;

    const totalFiles = files.length;
    const identityFiles = files.filter((f) => IDENTITY_FILES.includes(f.name)).length;
    const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);
    const hasSize = files.some((f) => f.size != null && f.size > 0);

    container.innerHTML = `
      <div class="stat-card glass-card stagger-item">
        <div class="stat-label">${ICONS.fileTotal} Total Files</div>
        <div class="stat-value stat-value--blue">${totalFiles}</div>
        <div class="stat-delta">${totalFiles === 1 ? '1 file' : `${totalFiles} files`} in memory</div>
      </div>
      <div class="stat-card glass-card stagger-item">
        <div class="stat-label">${ICONS.identity} Identity Files</div>
        <div class="stat-value stat-value--purple">${identityFiles}</div>
        <div class="stat-delta">${identityFiles} of ${IDENTITY_FILES.length} configured</div>
      </div>
      <div class="stat-card glass-card stagger-item">
        <div class="stat-label">${ICONS.size} Total Size</div>
        <div class="stat-value stat-value--green">${hasSize ? formatFileSize(totalSize) : '--'}</div>
        <div class="stat-delta">${hasSize ? 'Across all files' : 'Size data unavailable'}</div>
      </div>
    `;
  }

  /* ─────────── File List ─────────── */

  /**
   * Render the file list sidebar.
   * @private
   * @param {Array} files
   */
  _renderFileList(files) {
    const listEl = document.getElementById('file-list-items');
    if (!listEl) return;

    if (!files || files.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state" style="padding:var(--space-8)">
          <p class="empty-state-title">No files</p>
          <p class="empty-state-desc">Create your first memory file to get started.</p>
        </div>`;
      return;
    }

    // Sort: identity files first, then alphabetical
    const sorted = [...files].sort((a, b) => {
      const aIsIdentity = IDENTITY_FILES.includes(a.name);
      const bIsIdentity = IDENTITY_FILES.includes(b.name);
      if (aIsIdentity && !bIsIdentity) return -1;
      if (!aIsIdentity && bIsIdentity) return 1;
      return a.name.localeCompare(b.name);
    });

    listEl.innerHTML = sorted
      .map((f) => {
        const isIdentity = IDENTITY_FILES.includes(f.name);
        const isSelected = this._selectedFile === f.name;
        const sizeStr = f.size != null ? formatFileSize(f.size) : '';
        const dateStr = formatDate(f.modified || f.modifiedAt || f.updated_at);

        return `
          <div class="file-item${isSelected ? ' active' : ''}" data-filename="${escapeHtml(f.name)}">
            <div class="file-item-icon" style="${isIdentity ? 'background:var(--accent-purple-dim);color:var(--accent-purple)' : ''}">
              ${isIdentity ? ICONS.star : ICONS.file}
            </div>
            <div class="file-item-info">
              <div class="file-item-name">${escapeHtml(f.name)}</div>
              <div class="file-item-meta">
                ${sizeStr ? `<span class="file-item-size">${sizeStr}</span>` : ''}
                ${sizeStr && dateStr ? '<span class="file-item-dot"></span>' : ''}
                ${dateStr ? `<span class="file-item-date">${dateStr}</span>` : ''}
                ${!sizeStr && !dateStr && isIdentity ? '<span class="file-item-size" style="color:var(--accent-purple)">Identity</span>' : ''}
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    // Bind click handlers
    listEl.querySelectorAll('.file-item').forEach((el) => {
      el.addEventListener('click', () => {
        const filename = el.getAttribute('data-filename');
        this._selectFile(filename);
      });
    });
  }

  /* ─────────── File Selection ─────────── */

  /**
   * Select and display a memory file.
   * @private
   * @param {string} filename
   */
  async _selectFile(filename) {
    this._selectedFile = filename;
    this._editMode = false;

    // Update active state in list
    document.querySelectorAll('.file-item').forEach((el) => {
      el.classList.toggle('active', el.getAttribute('data-filename') === filename);
    });

    const headerEl = document.getElementById('viewer-header');
    const filenameEl = document.getElementById('viewer-filename');
    const filepathEl = document.getElementById('viewer-filepath');
    const contentEl = document.getElementById('viewer-content');
    const editEl = document.getElementById('viewer-edit');
    const editIcon = document.getElementById('edit-toggle-icon');
    const editLabel = document.getElementById('edit-toggle-label');

    if (headerEl) headerEl.style.display = 'flex';
    if (filenameEl) filenameEl.textContent = filename;
    if (filepathEl) filepathEl.textContent = `/memory/${filename}`;
    if (editEl) editEl.style.display = 'none';
    if (editIcon) editIcon.innerHTML = ICONS.edit;
    if (editLabel) editLabel.textContent = 'Edit';
    if (contentEl) {
      contentEl.style.display = 'block';
      contentEl.innerHTML = '<div class="loader-overlay" style="min-height:200px"><div class="spinner"></div></div>';
    }

    try {
      const data = await this.api.fetchMemoryFile(filename);
      const content = typeof data === 'string' ? data : data.content || data.text || '';
      this._rawContent = content;

      if (contentEl) {
        contentEl.innerHTML = content
          ? `<div class="rendered-markdown">${renderMarkdown(content)}</div>`
          : '<div class="empty-state" style="padding:var(--space-8)"><p class="empty-state-desc">File is empty. Click Edit to add content.</p></div>';
      }
    } catch (err) {
      if (contentEl) {
        contentEl.innerHTML = `
          <div class="empty-state" style="padding:var(--space-8)">
            <p class="error-text">Failed to load file: ${escapeHtml(err.message)}</p>
          </div>`;
      }
    }
  }

  /* ─────────── Edit Mode ─────────── */

  /**
   * Toggle between view and edit mode.
   * @private
   * @param {boolean} [forceState]
   */
  _toggleEdit(forceState) {
    if (!this._selectedFile) return;

    this._editMode = forceState !== undefined ? forceState : !this._editMode;

    const contentEl = document.getElementById('viewer-content');
    const editEl = document.getElementById('viewer-edit');
    const editIcon = document.getElementById('edit-toggle-icon');
    const editLabel = document.getElementById('edit-toggle-label');
    const textarea = document.getElementById('memory-edit-textarea');

    if (this._editMode) {
      if (contentEl) contentEl.style.display = 'none';
      if (editEl) editEl.style.display = 'flex';
      if (textarea) {
        textarea.value = this._rawContent;
        textarea.focus();
      }
      if (editIcon) editIcon.innerHTML = ICONS.eye;
      if (editLabel) editLabel.textContent = 'View';
      this._updateEditorMeta();
    } else {
      if (contentEl) contentEl.style.display = 'block';
      if (editEl) editEl.style.display = 'none';
      if (editIcon) editIcon.innerHTML = ICONS.edit;
      if (editLabel) editLabel.textContent = 'Edit';
    }
  }

  /**
   * Update the editor footer meta information (character / line count).
   * @private
   */
  _updateEditorMeta() {
    const textarea = document.getElementById('memory-edit-textarea');
    const metaEl = document.getElementById('editor-meta');
    if (!textarea || !metaEl) return;

    const chars = textarea.value.length;
    const lines = textarea.value.split('\n').length;
    metaEl.textContent = `${chars.toLocaleString()} chars, ${lines} lines`;
  }

  /* ─────────── Save ─────────── */

  /**
   * Save the currently edited file.
   * @private
   */
  async _saveFile() {
    if (!this._selectedFile) return;

    const textarea = document.getElementById('memory-edit-textarea');
    if (!textarea) return;

    const content = textarea.value;
    const saveBtn = document.getElementById('edit-save');

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
    }

    try {
      await this.api.saveMemoryFile(this._selectedFile, content);
      this._rawContent = content;

      // Update rendered view
      const contentEl = document.getElementById('viewer-content');
      if (contentEl) {
        contentEl.innerHTML = content
          ? `<div class="rendered-markdown">${renderMarkdown(content)}</div>`
          : '<div class="empty-state" style="padding:var(--space-8)"><p class="empty-state-desc">File is empty</p></div>';
      }

      this._toggleEdit(false);
      showToast('File saved successfully', 'success');
    } catch (err) {
      showToast(`Save failed: ${err.message}`, 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
      }
    }
  }

  /* ─────────── Create File ─────────── */

  /**
   * Show the create file modal.
   * @private
   */
  _showCreateModal() {
    const modal = document.getElementById('create-modal');
    const input = document.getElementById('create-filename-input');
    if (modal) modal.style.display = 'flex';
    if (input) {
      input.value = '';
      setTimeout(() => input.focus(), 100);
    }
  }

  /**
   * Create a new memory file via the API.
   * @private
   */
  async _createFile() {
    const input = document.getElementById('create-filename-input');
    if (!input) return;

    let filename = input.value.trim();
    if (!filename) {
      showToast('Please enter a filename', 'warning');
      return;
    }

    // Ensure it has an extension
    if (!filename.includes('.')) {
      filename += '.md';
    }

    const confirmBtn = document.getElementById('create-confirm');
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Creating...';
    }

    try {
      await this.api.saveMemoryFile(filename, '');
      showToast(`Created ${filename}`, 'success');

      // Hide modal
      const modal = document.getElementById('create-modal');
      if (modal) modal.style.display = 'none';

      // Refresh file list
      await this.api.fetchMemoryFiles();

      // Select the new file
      this._selectFile(filename);
    } catch (err) {
      showToast(`Create failed: ${err.message}`, 'error');
    } finally {
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Create File';
      }
    }
  }

  /* ─────────── Delete File ─────────── */

  /**
   * Show the delete confirmation modal.
   * @private
   */
  _showDeleteModal() {
    if (!this._selectedFile) return;
    const modal = document.getElementById('delete-modal');
    const nameEl = document.getElementById('delete-filename-display');
    if (nameEl) nameEl.textContent = this._selectedFile;
    if (modal) modal.style.display = 'flex';
  }

  /**
   * Delete the currently selected file.
   * @private
   */
  async _deleteFile() {
    if (!this._selectedFile) return;

    const confirmBtn = document.getElementById('delete-confirm');
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Deleting...';
    }

    try {
      // Try DELETE endpoint; fall back to saving empty content as a signal
      try {
        await this.api._delete(`/api/memory/${encodeURIComponent(this._selectedFile)}`);
      } catch {
        // Fallback: some backends may not have DELETE; try POST with _delete flag
        await this.api._post('/api/memory', { filename: this._selectedFile, _delete: true });
      }

      showToast(`Deleted ${this._selectedFile}`, 'success');

      // Reset viewer
      this._selectedFile = null;
      this._rawContent = '';

      const headerEl = document.getElementById('viewer-header');
      const contentEl = document.getElementById('viewer-content');
      const editEl = document.getElementById('viewer-edit');

      if (headerEl) headerEl.style.display = 'none';
      if (editEl) editEl.style.display = 'none';
      if (contentEl) {
        contentEl.style.display = 'block';
        contentEl.innerHTML = `
          <div class="empty-state">
            <p class="empty-state-title">File deleted</p>
            <p class="empty-state-desc">Select another file from the sidebar.</p>
          </div>`;
      }

      // Hide modal and refresh
      const modal = document.getElementById('delete-modal');
      if (modal) modal.style.display = 'none';

      await this.api.fetchMemoryFiles();
    } catch (err) {
      showToast(`Delete failed: ${err.message}`, 'error');
    } finally {
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Delete';
      }
    }
  }

  /* ─────────── Search ─────────── */

  /**
   * Search memory files.
   * @private
   * @param {string} query
   */
  async _search(query) {
    const resultsContainer = document.getElementById('memory-search-results');
    const resultsList = document.getElementById('search-results-list');

    if (!resultsContainer || !resultsList) return;

    resultsContainer.style.display = 'block';
    resultsList.innerHTML = '<div class="loader-overlay" style="min-height:80px"><div class="spinner spinner--sm"></div><span style="color:var(--text-muted);font-size:var(--font-size-sm)">Searching...</span></div>';

    try {
      const results = await this.api.searchMemory(query);

      if (!results || (Array.isArray(results) && results.length === 0)) {
        resultsList.innerHTML = `
          <div class="empty-state" style="padding:var(--space-6)">
            <p class="empty-state-desc">No results found for "${escapeHtml(query)}"</p>
          </div>`;
        return;
      }

      const items = Array.isArray(results) ? results : results.results || [];

      resultsList.innerHTML = items
        .map((r) => {
          const filename = r.filename || r.file || 'Unknown';
          const context = r.context || r.snippet || r.match || '';
          const line = r.line;
          const isIdentity = IDENTITY_FILES.includes(filename);

          return `
            <div class="search-result-item" data-filename="${escapeHtml(filename)}" style="
              padding: var(--space-3) var(--space-4);
              border-radius: var(--radius-md);
              cursor: pointer;
              transition: background var(--transition-fast);
              border-bottom: 1px solid var(--border-subtle);
            ">
              <div style="display:flex;align-items:center;gap:var(--space-2);margin-bottom:var(--space-1)">
                <span style="color:${isIdentity ? 'var(--accent-purple)' : 'var(--accent-blue)'}">${isIdentity ? ICONS.star : ICONS.file}</span>
                <strong style="color:var(--text-white);font-size:var(--font-size-sm)">${escapeHtml(filename)}</strong>
                ${line != null ? `<span style="font-size:var(--font-size-xs);color:var(--text-muted);font-family:var(--font-mono)">line ${line}</span>` : ''}
              </div>
              <div style="font-size:var(--font-size-sm);color:var(--text-secondary);line-height:var(--line-height-relaxed);padding-left:var(--space-5)">
                ${highlightMatches(context, query)}
              </div>
            </div>
          `;
        })
        .join('');

      // Click to navigate
      resultsList.querySelectorAll('.search-result-item').forEach((el) => {
        // Hover effect
        el.addEventListener('mouseenter', () => { el.style.background = 'var(--bg-surface-hover)'; });
        el.addEventListener('mouseleave', () => { el.style.background = 'transparent'; });

        el.addEventListener('click', () => {
          const filename = el.getAttribute('data-filename');
          if (filename) {
            this._selectFile(filename);
            resultsContainer.style.display = 'none';
          }
        });
      });
    } catch (err) {
      resultsList.innerHTML = `
        <div class="empty-state" style="padding:var(--space-6)">
          <p class="error-text">Search failed: ${escapeHtml(err.message)}</p>
        </div>`;
    }
  }

  /* ─────────── Cleanup ─────────── */

  /**
   * Cleanup subscriptions and event handlers.
   * @private
   */
  _cleanup() {
    this._unsubs.forEach((fn) => fn());
    this._unsubs = [];
  }
}
