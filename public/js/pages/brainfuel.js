/**
 * Brain Fuel — AI-Powered Nutrition Tracker Page
 * Photo meal logging with AI vision analysis, text meal logging,
 * daily macro dashboard, editable meal items, and nutrition goals.
 */

import { showToast } from '../components/toast.js';
import { escapeHtml, $ } from '../utils.js';

const ICONS = {
  brainfuel: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`,
  camera: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 012-2h2l1-2h4l1 2h2a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/><circle cx="10" cy="11" r="3"/></svg>`,
  text: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h12M4 8h8M4 12h10M4 16h6"/></svg>`,
  target: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><circle cx="10" cy="10" r="4"/><circle cx="10" cy="10" r="1"/></svg>`,
  close: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="5" x2="15" y2="15"/><line x1="15" y1="5" x2="5" y2="15"/></svg>`,
  chevronLeft: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 3L5 8l5 5"/></svg>`,
  chevronRight: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 3l5 5-5 5"/></svg>`,
  upload: `<svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="32" height="32" rx="4"/><path d="M20 12v16M14 18l6-6 6 6"/></svg>`,
  fire: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 1c0 3-4 5-4 8a5 5 0 0010 0c0-3-4-5-4-8z"/></svg>`,
  star: `<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M7 0l2.2 4.4L14 5.1l-3.5 3.4.8 4.9L7 11.2 2.7 13.4l.8-4.9L0 5.1l4.8-.7z"/></svg>`,
  trash: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 4h10M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1M4 4v8a1 1 0 001 1h4a1 1 0 001-1V4"/></svg>`,
  edit: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8.5 2.5l3 3L4 13H1v-3L8.5 2.5z"/></svg>`,
  lightbulb: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 11h4M5.5 13h3M7 1a4 4 0 00-2 7.5V11h4V8.5A4 4 0 007 1z"/></svg>`,
};

const MACRO_COLORS = {
  calories: '#ff6b6b',
  protein: '#00b4d8',
  carbs: '#ff9f43',
  fat: '#7b2ff7',
  fiber: '#22c55e',
  sugar: '#ec4899',
};

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

export class BrainFuelPage {
  constructor(app) {
    this.state = app.state;
    this.api = app.api;
    this.router = app.router;
    this._unsubs = [];
    this._currentDate = new Date().toISOString().split('T')[0];
    this._meals = [];
    this._summary = null;
    this._goals = null;
    this._modalOpen = null;
    this._analysisResult = null;
    this._selectedImage = null;
    this._selectedMealType = 'meal';
  }

  render(mount) {
    mount.innerHTML = `
      <div class="page page-brainfuel">
        <!-- Gradient Hero Header -->
        <div class="page-gradient-header gradient-brainfuel">
          <div class="page-header-content">
            <h1 class="page-title">
              <span class="page-title-icon">${ICONS.brainfuel}</span>
              Brain Fuel
            </h1>
            <p class="page-subtitle">AI-powered nutrition tracking — snap, analyze, optimize</p>
          </div>
        </div>

        <!-- Date Navigator -->
        <div class="bf-date-nav" id="bf-date-nav">
          <button class="bf-date-nav-btn" id="bf-date-prev" title="Previous day">${ICONS.chevronLeft}</button>
          <span class="bf-date-display" id="bf-date-display"></span>
          <button class="bf-date-nav-btn" id="bf-date-next" title="Next day">${ICONS.chevronRight}</button>
          <button class="bf-date-today-btn" id="bf-date-today">Today</button>
        </div>

        <!-- Daily Macro Cards -->
        <section class="bf-macro-grid" id="bf-macro-grid">
          <!-- Rendered dynamically -->
        </section>

        <!-- Action Buttons -->
        <div class="bf-actions-row">
          <button class="bf-action-btn bf-action-btn--primary" id="bf-log-photo">
            ${ICONS.camera}
            <span>Log Meal by Photo</span>
          </button>
          <button class="bf-action-btn bf-action-btn--secondary" id="bf-log-text">
            ${ICONS.text}
            <span>Log Meal by Text</span>
          </button>
          <button class="bf-action-btn" id="bf-set-goals">
            ${ICONS.target}
            <span>Set Goals</span>
          </button>
        </div>

        <!-- Today's Meals -->
        <section class="bf-meals-section" id="bf-meals-section">
          <h2 class="section-title">
            <span class="section-title-icon">${ICONS.fire}</span>
            Today's Meals
          </h2>
          <div id="bf-meals-list">
            <div class="loader-overlay" style="min-height:150px"><div class="spinner"></div></div>
          </div>
        </section>
      </div>

      <!-- Modal Container -->
      <div id="bf-modal-container"></div>
    `;

    this._updateDateDisplay();
    this._bindEvents(mount);
    this._fetchData();

    return () => this._cleanup();
  }

  // ─── Events ─────────────────────────────────────────────

  _bindEvents(mount) {
    const prevBtn = $('#bf-date-prev', mount);
    const nextBtn = $('#bf-date-next', mount);
    const todayBtn = $('#bf-date-today', mount);
    const photoBtn = $('#bf-log-photo', mount);
    const textBtn = $('#bf-log-text', mount);
    const goalsBtn = $('#bf-set-goals', mount);

    if (prevBtn) prevBtn.addEventListener('click', () => this._changeDate(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => this._changeDate(1));
    if (todayBtn) todayBtn.addEventListener('click', () => {
      this._currentDate = new Date().toISOString().split('T')[0];
      this._updateDateDisplay();
      this._fetchData();
    });
    if (photoBtn) photoBtn.addEventListener('click', () => this._openPhotoModal());
    if (textBtn) textBtn.addEventListener('click', () => this._openTextModal());
    if (goalsBtn) goalsBtn.addEventListener('click', () => this._openGoalsModal());
  }

  _changeDate(delta) {
    const d = new Date(this._currentDate + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    this._currentDate = d.toISOString().split('T')[0];
    this._updateDateDisplay();
    this._fetchData();
  }

  _updateDateDisplay() {
    const display = document.getElementById('bf-date-display');
    if (!display) return;

    const today = new Date().toISOString().split('T')[0];
    const d = new Date(this._currentDate + 'T12:00:00');
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    const formatted = d.toLocaleDateString('en-US', options);

    display.textContent = this._currentDate === today ? `${formatted} — Today` : formatted;
  }

  // ─── Data Fetching ──────────────────────────────────────

  async _fetchData() {
    try {
      const [meals, summary, goals] = await Promise.all([
        this._apiGet(`/api/brainfuel/meals?date=${this._currentDate}`),
        this._apiGet(`/api/brainfuel/summary?date=${this._currentDate}`),
        this._apiGet('/api/brainfuel/goals'),
      ]);
      this._meals = meals || [];
      this._summary = summary || {};
      this._goals = goals || { calories: 2000, protein_g: 150, carbs_g: 250, fat_g: 65 };
      this._renderMacros();
      this._renderMeals();
    } catch (err) {
      console.error('Brain Fuel: fetch error', err);
      this._meals = [];
      this._summary = {};
      this._goals = { calories: 2000, protein_g: 150, carbs_g: 250, fat_g: 65 };
      this._renderMacros();
      this._renderMeals();
    }
  }

  async _apiGet(path) {
    const headers = {};
    const token = localStorage.getItem('aios_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
    headers['Content-Type'] = 'application/json';
    const res = await fetch(path, { headers });
    if (!res.ok) throw new Error(`GET ${path}: ${res.status}`);
    return res.json();
  }

  async _apiPost(path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('aios_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `POST ${path}: ${res.status}`);
    }
    return res.json();
  }

  async _apiPut(path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('aios_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(path, { method: 'PUT', headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`PUT ${path}: ${res.status}`);
    return res.json();
  }

  async _apiDelete(path) {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('aios_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(path, { method: 'DELETE', headers });
    if (!res.ok) throw new Error(`DELETE ${path}: ${res.status}`);
    return res.json();
  }

  // ─── Render Macros ──────────────────────────────────────

  _renderMacros() {
    const grid = document.getElementById('bf-macro-grid');
    if (!grid) return;

    const s = this._summary || {};
    const g = this._goals || {};

    const macros = [
      { label: 'Calories', value: Math.round(s.total_calories || 0), goal: g.calories || 2000, unit: 'kcal', color: MACRO_COLORS.calories },
      { label: 'Protein', value: Math.round((s.total_protein_g || 0) * 10) / 10, goal: g.protein_g || 150, unit: 'g', color: MACRO_COLORS.protein },
      { label: 'Carbs', value: Math.round((s.total_carbs_g || 0) * 10) / 10, goal: g.carbs_g || 250, unit: 'g', color: MACRO_COLORS.carbs },
      { label: 'Fat', value: Math.round((s.total_fat_g || 0) * 10) / 10, goal: g.fat_g || 65, unit: 'g', color: MACRO_COLORS.fat },
    ];

    grid.innerHTML = macros.map(m => {
      const pct = Math.min(100, Math.round((m.value / m.goal) * 100));
      return `
        <div class="bf-macro-card">
          <div class="macro-label">${m.label}</div>
          <div class="macro-value" style="color:${m.color}">${m.value}<span style="font-size:0.6em;color:var(--text-muted)"> ${m.unit}</span></div>
          <div class="macro-goal">of ${m.goal}${m.unit} goal (${pct}%)</div>
          <div class="macro-bar">
            <div class="macro-bar-fill" style="width:${pct}%;background:${m.color}"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ─── Render Meals ───────────────────────────────────────

  _renderMeals() {
    const container = document.getElementById('bf-meals-list');
    if (!container) return;

    if (!this._meals || this._meals.length === 0) {
      container.innerHTML = `
        <div class="bf-empty-state">
          <div class="bf-empty-state-icon">${ICONS.camera}</div>
          <p class="bf-empty-state-title">No meals logged yet</p>
          <p class="bf-empty-state-desc">Take a photo of your meal or describe it to get started with AI-powered nutrition tracking.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this._meals.map(meal => {
      const time = meal.created_at ? new Date(meal.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
      const mealType = meal.meal_type || 'meal';
      return `
        <div class="bf-meal-card" data-meal-id="${meal.id}">
          <div class="bf-meal-header">
            <div class="bf-meal-type">
              <span class="bf-meal-type-badge bf-meal-type-badge--${mealType}">${mealType}</span>
              ${meal.summary ? `<span style="font-weight:normal;font-size:var(--font-size-sm);color:var(--text-secondary)">${escapeHtml(meal.summary)}</span>` : ''}
            </div>
            <div style="display:flex;align-items:center;gap:var(--space-2)">
              <span class="bf-meal-time">${time}</span>
              <button class="bf-meal-delete-btn" data-delete-meal="${meal.id}" title="Delete meal">${ICONS.trash}</button>
            </div>
          </div>
          ${meal.health_score ? `
            <div style="margin-bottom:var(--space-2)">
              <span class="health-score" style="display:inline-flex;align-items:center;gap:4px;font-size:var(--font-size-xs);color:var(--accent-green)">
                ${ICONS.star} Health Score: ${meal.health_score}/10
              </span>
            </div>
          ` : ''}
          <div class="bf-meal-macros-row">
            <div class="bf-meal-macro-item">
              <span class="bf-meal-macro-value" style="color:${MACRO_COLORS.calories}">${Math.round(meal.total_calories || 0)}</span>
              <span class="bf-meal-macro-label">kcal</span>
            </div>
            <div class="bf-meal-macro-item">
              <span class="bf-meal-macro-value" style="color:${MACRO_COLORS.protein}">${Math.round((meal.total_protein_g || 0) * 10) / 10}g</span>
              <span class="bf-meal-macro-label">protein</span>
            </div>
            <div class="bf-meal-macro-item">
              <span class="bf-meal-macro-value" style="color:${MACRO_COLORS.carbs}">${Math.round((meal.total_carbs_g || 0) * 10) / 10}g</span>
              <span class="bf-meal-macro-label">carbs</span>
            </div>
            <div class="bf-meal-macro-item">
              <span class="bf-meal-macro-value" style="color:${MACRO_COLORS.fat}">${Math.round((meal.total_fat_g || 0) * 10) / 10}g</span>
              <span class="bf-meal-macro-label">fat</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Bind delete buttons
    container.querySelectorAll('[data-delete-meal]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const mealId = btn.dataset.deleteMeal;
        if (!confirm('Delete this meal?')) return;
        try {
          await this._apiDelete(`/api/brainfuel/meals/${mealId}`);
          showToast('Meal deleted', 'success');
          this._fetchData();
        } catch (err) {
          showToast('Failed to delete meal: ' + err.message, 'error');
        }
      });
    });

    // Bind card click to expand
    container.querySelectorAll('.bf-meal-card').forEach(card => {
      card.addEventListener('click', () => {
        const mealId = card.dataset.mealId;
        this._openMealDetail(mealId);
      });
    });
  }

  // ─── Photo Upload Modal ─────────────────────────────────

  _openPhotoModal() {
    this._analysisResult = null;
    this._selectedImage = null;
    this._selectedMealType = 'meal';

    const container = document.getElementById('bf-modal-container');
    container.innerHTML = `
      <div class="bf-modal-backdrop" id="bf-modal-backdrop">
        <div class="bf-modal" id="bf-photo-modal">
          <div class="bf-modal-header">
            <h2>${ICONS.camera} Log Meal by Photo</h2>
            <button class="bf-modal-close" id="bf-modal-close">${ICONS.close}</button>
          </div>
          <p style="color:var(--text-secondary);font-size:var(--font-size-sm);margin-bottom:var(--space-4)">
            Take a photo or upload an image of your meal. AI will analyze the ingredients and nutrition.
          </p>

          <div class="bf-meal-type-selector" id="bf-type-selector">
            ${MEAL_TYPES.map(t => `
              <button class="bf-meal-type-option${t === 'meal' ? '' : ''}" data-type="${t}">${t}</button>
            `).join('')}
          </div>

          <div class="bf-dropzone" id="bf-dropzone">
            <div class="bf-dropzone-icon">${ICONS.upload}</div>
            <div class="bf-dropzone-text">Click to upload or drag and drop</div>
            <div class="bf-dropzone-hint">JPEG, PNG, WebP up to 8MB</div>
            <input type="file" id="bf-file-input" accept="image/jpeg,image/png,image/webp" style="display:none">
          </div>

          <div id="bf-analysis-area"></div>

          <div style="display:flex;gap:var(--space-3);margin-top:var(--space-4)">
            <button class="bf-action-btn" id="bf-choose-file" style="flex:1;justify-content:center">Choose File</button>
            <button class="bf-action-btn bf-action-btn--primary" id="bf-analyze-btn" style="flex:1;justify-content:center" disabled>
              Analyze Meal
            </button>
          </div>
        </div>
      </div>
    `;

    this._bindPhotoModalEvents();
  }

  _bindPhotoModalEvents() {
    const backdrop = document.getElementById('bf-modal-backdrop');
    const closeBtn = document.getElementById('bf-modal-close');
    const dropzone = document.getElementById('bf-dropzone');
    const fileInput = document.getElementById('bf-file-input');
    const chooseBtn = document.getElementById('bf-choose-file');
    const analyzeBtn = document.getElementById('bf-analyze-btn');
    const typeSelector = document.getElementById('bf-type-selector');

    // Close
    closeBtn?.addEventListener('click', () => this._closeModal());
    backdrop?.addEventListener('click', (e) => { if (e.target === backdrop) this._closeModal(); });

    // Meal type
    typeSelector?.querySelectorAll('.bf-meal-type-option').forEach(btn => {
      btn.addEventListener('click', () => {
        typeSelector.querySelectorAll('.bf-meal-type-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._selectedMealType = btn.dataset.type;
      });
    });

    // File selection
    chooseBtn?.addEventListener('click', () => fileInput?.click());
    dropzone?.addEventListener('click', () => fileInput?.click());

    // Drag and drop
    dropzone?.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) this._handleFileSelect(file);
    });

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this._handleFileSelect(file);
    });

    // Analyze
    analyzeBtn?.addEventListener('click', () => this._analyzePhoto());
  }

  _handleFileSelect(file) {
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      showToast('Please select a JPEG, PNG, or WebP image', 'error');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast('Image too large. Maximum size is 8MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      this._selectedImage = {
        base64: dataUrl.split(',')[1],
        mimeType: file.type,
        preview: dataUrl,
      };

      // Update dropzone with preview
      const dropzone = document.getElementById('bf-dropzone');
      if (dropzone) {
        dropzone.innerHTML = `
          <img src="${dataUrl}" class="bf-dropzone-preview" alt="Meal preview">
          <div class="bf-dropzone-text" style="font-size:var(--font-size-sm)">${escapeHtml(file.name)}</div>
          <div class="bf-dropzone-hint">Click to change image</div>
        `;
      }

      // Enable analyze button
      const analyzeBtn = document.getElementById('bf-analyze-btn');
      if (analyzeBtn) analyzeBtn.disabled = false;
    };
    reader.readAsDataURL(file);
  }

  async _analyzePhoto() {
    if (!this._selectedImage) return;

    const area = document.getElementById('bf-analysis-area');
    const analyzeBtn = document.getElementById('bf-analyze-btn');
    if (analyzeBtn) analyzeBtn.disabled = true;

    area.innerHTML = `
      <div class="bf-analysis-loading">
        <div class="spinner spinner--lg"></div>
        <p style="color:var(--text-secondary)">Analyzing your meal with AI...</p>
        <p style="color:var(--text-muted);font-size:var(--font-size-xs)">This may take a few seconds</p>
      </div>
    `;

    try {
      const result = await this._apiPost('/api/brainfuel/analyze/photo', {
        image: this._selectedImage.base64,
        mimeType: this._selectedImage.mimeType,
      });

      if (result.ok) {
        this._analysisResult = result.analysis;
        this._renderAnalysisReview(area, result.analysis);
      } else {
        area.innerHTML = `<div style="color:var(--accent-red);padding:var(--space-4)">${escapeHtml(result.error || 'Analysis failed')}</div>`;
        if (analyzeBtn) analyzeBtn.disabled = false;
      }
    } catch (err) {
      area.innerHTML = `<div style="color:var(--accent-red);padding:var(--space-4)">Error: ${escapeHtml(err.message)}</div>`;
      if (analyzeBtn) analyzeBtn.disabled = false;
    }
  }

  // ─── Text Meal Modal ────────────────────────────────────

  _openTextModal() {
    this._analysisResult = null;
    this._selectedMealType = 'meal';

    const container = document.getElementById('bf-modal-container');
    container.innerHTML = `
      <div class="bf-modal-backdrop" id="bf-modal-backdrop">
        <div class="bf-modal" id="bf-text-modal">
          <div class="bf-modal-header">
            <h2>${ICONS.text} Log Meal by Text</h2>
            <button class="bf-modal-close" id="bf-modal-close">${ICONS.close}</button>
          </div>
          <p style="color:var(--text-secondary);font-size:var(--font-size-sm);margin-bottom:var(--space-4)">
            Describe what you ate and AI will estimate the nutritional content.
          </p>

          <div class="bf-meal-type-selector" id="bf-type-selector">
            ${MEAL_TYPES.map(t => `
              <button class="bf-meal-type-option" data-type="${t}">${t}</button>
            `).join('')}
          </div>

          <textarea class="bf-text-input" id="bf-meal-description"
                    placeholder="e.g., Grilled chicken breast with brown rice, steamed broccoli, and a side salad with olive oil dressing"></textarea>

          <div id="bf-text-analysis-area"></div>

          <div style="display:flex;gap:var(--space-3);margin-top:var(--space-4)">
            <button class="bf-action-btn bf-action-btn--primary" id="bf-text-analyze-btn" style="flex:1;justify-content:center">
              Analyze Meal
            </button>
          </div>
        </div>
      </div>
    `;

    // Bind events
    const backdrop = document.getElementById('bf-modal-backdrop');
    const closeBtn = document.getElementById('bf-modal-close');
    const analyzeBtn = document.getElementById('bf-text-analyze-btn');
    const typeSelector = document.getElementById('bf-type-selector');

    closeBtn?.addEventListener('click', () => this._closeModal());
    backdrop?.addEventListener('click', (e) => { if (e.target === backdrop) this._closeModal(); });

    typeSelector?.querySelectorAll('.bf-meal-type-option').forEach(btn => {
      btn.addEventListener('click', () => {
        typeSelector.querySelectorAll('.bf-meal-type-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._selectedMealType = btn.dataset.type;
      });
    });

    analyzeBtn?.addEventListener('click', async () => {
      const desc = document.getElementById('bf-meal-description')?.value?.trim();
      if (!desc) {
        showToast('Please describe your meal', 'error');
        return;
      }

      const area = document.getElementById('bf-text-analysis-area');
      analyzeBtn.disabled = true;

      area.innerHTML = `
        <div class="bf-analysis-loading">
          <div class="spinner spinner--lg"></div>
          <p style="color:var(--text-secondary)">Analyzing your meal with AI...</p>
        </div>
      `;

      try {
        const result = await this._apiPost('/api/brainfuel/analyze/text', { description: desc });
        if (result.ok) {
          this._analysisResult = result.analysis;
          this._renderAnalysisReview(area, result.analysis);
        } else {
          area.innerHTML = `<div style="color:var(--accent-red);padding:var(--space-4)">${escapeHtml(result.error || 'Analysis failed')}</div>`;
          analyzeBtn.disabled = false;
        }
      } catch (err) {
        area.innerHTML = `<div style="color:var(--accent-red);padding:var(--space-4)">Error: ${escapeHtml(err.message)}</div>`;
        analyzeBtn.disabled = false;
      }
    });
  }

  // ─── Analysis Review & Save ─────────────────────────────

  _renderAnalysisReview(area, analysis) {
    const totalCal = analysis.items.reduce((s, i) => s + (i.calories || 0), 0);
    const totalProt = analysis.items.reduce((s, i) => s + (i.protein_g || 0), 0);
    const totalCarbs = analysis.items.reduce((s, i) => s + (i.carbs_g || 0), 0);
    const totalFat = analysis.items.reduce((s, i) => s + (i.fat_g || 0), 0);

    area.innerHTML = `
      <div class="bf-review-section">
        <div class="bf-review-summary">
          <div class="summary-text">${escapeHtml(analysis.meal_summary)}</div>
          <div class="health-score">${ICONS.star} Health Score: ${analysis.health_score}/10</div>
          ${analysis.suggestions && analysis.suggestions.length > 0 ? `
            <div class="bf-suggestions">
              ${analysis.suggestions.map(s => `
                <div class="bf-suggestion-item">
                  <span class="bf-suggestion-icon">${ICONS.lightbulb}</span>
                  <span>${escapeHtml(s)}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>

        <div style="display:flex;gap:var(--space-4);margin-bottom:var(--space-4);flex-wrap:wrap">
          <div style="text-align:center;flex:1;min-width:60px">
            <div style="font-size:var(--font-size-xl);font-weight:700;color:${MACRO_COLORS.calories}">${Math.round(totalCal)}</div>
            <div style="font-size:var(--font-size-xs);color:var(--text-muted)">CALORIES</div>
          </div>
          <div style="text-align:center;flex:1;min-width:60px">
            <div style="font-size:var(--font-size-xl);font-weight:700;color:${MACRO_COLORS.protein}">${Math.round(totalProt * 10) / 10}g</div>
            <div style="font-size:var(--font-size-xs);color:var(--text-muted)">PROTEIN</div>
          </div>
          <div style="text-align:center;flex:1;min-width:60px">
            <div style="font-size:var(--font-size-xl);font-weight:700;color:${MACRO_COLORS.carbs}">${Math.round(totalCarbs * 10) / 10}g</div>
            <div style="font-size:var(--font-size-xs);color:var(--text-muted)">CARBS</div>
          </div>
          <div style="text-align:center;flex:1;min-width:60px">
            <div style="font-size:var(--font-size-xl);font-weight:700;color:${MACRO_COLORS.fat}">${Math.round(totalFat * 10) / 10}g</div>
            <div style="font-size:var(--font-size-xs);color:var(--text-muted)">FAT</div>
          </div>
        </div>

        <h3 style="font-size:var(--font-size-base);font-weight:600;margin-bottom:var(--space-3)">Detected Items (${analysis.items.length})</h3>
        <div class="bf-items-list" id="bf-review-items">
          ${analysis.items.map((item, i) => this._renderReviewItem(item, i)).join('')}
        </div>

        <div style="display:flex;gap:var(--space-3);margin-top:var(--space-6)">
          <button class="bf-action-btn bf-action-btn--primary" id="bf-save-meal" style="flex:1;justify-content:center">
            Save Meal
          </button>
          <button class="bf-action-btn" id="bf-discard-analysis" style="flex:1;justify-content:center">
            Discard
          </button>
        </div>
      </div>
    `;

    // Bind save/discard
    document.getElementById('bf-save-meal')?.addEventListener('click', () => this._saveMeal());
    document.getElementById('bf-discard-analysis')?.addEventListener('click', () => this._closeModal());

    // Bind item delete buttons
    area.querySelectorAll('[data-remove-item]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.removeItem, 10);
        this._analysisResult.items.splice(idx, 1);
        this._renderAnalysisReview(area, this._analysisResult);
      });
    });
  }

  _renderReviewItem(item, index) {
    return `
      <div class="bf-item-card">
        <div class="bf-item-header">
          <span class="bf-item-name">${escapeHtml(item.name)}</span>
          <button class="bf-item-action-btn bf-item-action-btn--delete" data-remove-item="${index}" title="Remove item">${ICONS.trash}</button>
        </div>
        <div class="bf-item-portion">${escapeHtml(item.portion)}${item.portion_notes ? ` — ${escapeHtml(item.portion_notes)}` : ''}</div>
        <div class="bf-item-macros">
          <div class="bf-item-macro"><span class="macro-dot" style="background:${MACRO_COLORS.calories}"></span>${item.calories} kcal</div>
          <div class="bf-item-macro"><span class="macro-dot" style="background:${MACRO_COLORS.protein}"></span>${item.protein_g}g protein</div>
          <div class="bf-item-macro"><span class="macro-dot" style="background:${MACRO_COLORS.carbs}"></span>${item.carbs_g}g carbs</div>
          <div class="bf-item-macro"><span class="macro-dot" style="background:${MACRO_COLORS.fat}"></span>${item.fat_g}g fat</div>
        </div>
      </div>
    `;
  }

  async _saveMeal() {
    if (!this._analysisResult || !this._analysisResult.items.length) {
      showToast('No items to save', 'error');
      return;
    }

    const saveBtn = document.getElementById('bf-save-meal');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }

    try {
      await this._apiPost('/api/brainfuel/meals', {
        date: this._currentDate,
        mealType: this._selectedMealType,
        summary: this._analysisResult.meal_summary,
        healthScore: this._analysisResult.health_score,
        suggestions: this._analysisResult.suggestions,
        items: this._analysisResult.items,
        analysisRaw: JSON.stringify(this._analysisResult),
      });

      showToast('Meal saved successfully!', 'success');
      this._closeModal();
      this._fetchData();
    } catch (err) {
      showToast('Failed to save meal: ' + err.message, 'error');
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Meal'; }
    }
  }

  // ─── Meal Detail Modal ──────────────────────────────────

  async _openMealDetail(mealId) {
    const container = document.getElementById('bf-modal-container');
    container.innerHTML = `
      <div class="bf-modal-backdrop" id="bf-modal-backdrop">
        <div class="bf-modal">
          <div class="bf-modal-header">
            <h2>Meal Details</h2>
            <button class="bf-modal-close" id="bf-modal-close">${ICONS.close}</button>
          </div>
          <div class="bf-analysis-loading">
            <div class="spinner"></div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('bf-modal-close')?.addEventListener('click', () => this._closeModal());
    document.getElementById('bf-modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'bf-modal-backdrop') this._closeModal();
    });

    try {
      const meal = await this._apiGet(`/api/brainfuel/meals/${mealId}`);
      const modal = container.querySelector('.bf-modal');
      const mealType = meal.meal_type || 'meal';
      const suggestions = Array.isArray(meal.suggestions) ? meal.suggestions : [];

      modal.innerHTML = `
        <div class="bf-modal-header">
          <h2><span class="bf-meal-type-badge bf-meal-type-badge--${mealType}">${mealType}</span> ${escapeHtml(meal.summary || 'Meal')}</h2>
          <button class="bf-modal-close" id="bf-modal-close">${ICONS.close}</button>
        </div>

        ${meal.health_score ? `
          <div style="margin-bottom:var(--space-4)">
            <span style="display:inline-flex;align-items:center;gap:4px;font-size:var(--font-size-sm);color:var(--accent-green)">
              ${ICONS.star} Health Score: ${meal.health_score}/10
            </span>
          </div>
        ` : ''}

        ${suggestions.length > 0 ? `
          <div class="bf-suggestions" style="margin-bottom:var(--space-4)">
            ${suggestions.map(s => `
              <div class="bf-suggestion-item">
                <span class="bf-suggestion-icon">${ICONS.lightbulb}</span>
                <span>${escapeHtml(s)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <div style="display:flex;gap:var(--space-4);margin-bottom:var(--space-4);flex-wrap:wrap;padding:var(--space-4);background:var(--bg-surface);border-radius:var(--radius-md)">
          <div style="text-align:center;flex:1">
            <div style="font-size:var(--font-size-xl);font-weight:700;color:${MACRO_COLORS.calories}">${Math.round(meal.total_calories || 0)}</div>
            <div style="font-size:var(--font-size-xs);color:var(--text-muted)">CALORIES</div>
          </div>
          <div style="text-align:center;flex:1">
            <div style="font-size:var(--font-size-xl);font-weight:700;color:${MACRO_COLORS.protein}">${Math.round((meal.total_protein_g || 0) * 10) / 10}g</div>
            <div style="font-size:var(--font-size-xs);color:var(--text-muted)">PROTEIN</div>
          </div>
          <div style="text-align:center;flex:1">
            <div style="font-size:var(--font-size-xl);font-weight:700;color:${MACRO_COLORS.carbs}">${Math.round((meal.total_carbs_g || 0) * 10) / 10}g</div>
            <div style="font-size:var(--font-size-xs);color:var(--text-muted)">CARBS</div>
          </div>
          <div style="text-align:center;flex:1">
            <div style="font-size:var(--font-size-xl);font-weight:700;color:${MACRO_COLORS.fat}">${Math.round((meal.total_fat_g || 0) * 10) / 10}g</div>
            <div style="font-size:var(--font-size-xs);color:var(--text-muted)">FAT</div>
          </div>
        </div>

        <h3 style="font-size:var(--font-size-base);font-weight:600;margin-bottom:var(--space-3)">Items (${(meal.items || []).length})</h3>
        <div class="bf-items-list">
          ${(meal.items || []).map(item => `
            <div class="bf-item-card">
              <div class="bf-item-header">
                <span class="bf-item-name">${escapeHtml(item.name)}</span>
              </div>
              <div class="bf-item-portion">${escapeHtml(item.portion)}${item.portion_notes ? ` — ${escapeHtml(item.portion_notes)}` : ''}</div>
              <div class="bf-item-macros">
                <div class="bf-item-macro"><span class="macro-dot" style="background:${MACRO_COLORS.calories}"></span>${Math.round(item.calories)} kcal</div>
                <div class="bf-item-macro"><span class="macro-dot" style="background:${MACRO_COLORS.protein}"></span>${item.protein_g}g protein</div>
                <div class="bf-item-macro"><span class="macro-dot" style="background:${MACRO_COLORS.carbs}"></span>${item.carbs_g}g carbs</div>
                <div class="bf-item-macro"><span class="macro-dot" style="background:${MACRO_COLORS.fat}"></span>${item.fat_g}g fat</div>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      modal.querySelector('#bf-modal-close')?.addEventListener('click', () => this._closeModal());
    } catch (err) {
      showToast('Failed to load meal details: ' + err.message, 'error');
      this._closeModal();
    }
  }

  // ─── Goals Modal ────────────────────────────────────────

  _openGoalsModal() {
    const g = this._goals || { calories: 2000, protein_g: 150, carbs_g: 250, fat_g: 65 };

    const container = document.getElementById('bf-modal-container');
    container.innerHTML = `
      <div class="bf-modal-backdrop" id="bf-modal-backdrop">
        <div class="bf-modal">
          <div class="bf-modal-header">
            <h2>${ICONS.target} Daily Nutrition Goals</h2>
            <button class="bf-modal-close" id="bf-modal-close">${ICONS.close}</button>
          </div>
          <p style="color:var(--text-secondary);font-size:var(--font-size-sm);margin-bottom:var(--space-6)">
            Set your daily nutrition targets. These will be used to track your progress.
          </p>
          <div class="bf-goals-form">
            <div class="form-group">
              <label>Calories (kcal)</label>
              <input type="number" id="bf-goal-calories" value="${g.calories}" min="500" max="10000">
            </div>
            <div class="form-group">
              <label>Protein (g)</label>
              <input type="number" id="bf-goal-protein" value="${g.protein_g}" min="10" max="500">
            </div>
            <div class="form-group">
              <label>Carbs (g)</label>
              <input type="number" id="bf-goal-carbs" value="${g.carbs_g}" min="10" max="1000">
            </div>
            <div class="form-group">
              <label>Fat (g)</label>
              <input type="number" id="bf-goal-fat" value="${g.fat_g}" min="10" max="500">
            </div>
          </div>
          <div style="display:flex;gap:var(--space-3);margin-top:var(--space-6)">
            <button class="bf-action-btn bf-action-btn--primary" id="bf-save-goals" style="flex:1;justify-content:center">Save Goals</button>
            <button class="bf-action-btn" id="bf-cancel-goals" style="flex:1;justify-content:center">Cancel</button>
          </div>
        </div>
      </div>
    `;

    const backdrop = document.getElementById('bf-modal-backdrop');
    const closeBtn = document.getElementById('bf-modal-close');
    const saveBtn = document.getElementById('bf-save-goals');
    const cancelBtn = document.getElementById('bf-cancel-goals');

    closeBtn?.addEventListener('click', () => this._closeModal());
    cancelBtn?.addEventListener('click', () => this._closeModal());
    backdrop?.addEventListener('click', (e) => { if (e.target === backdrop) this._closeModal(); });

    saveBtn?.addEventListener('click', async () => {
      const goals = {
        calories: parseInt(document.getElementById('bf-goal-calories')?.value) || 2000,
        protein_g: parseInt(document.getElementById('bf-goal-protein')?.value) || 150,
        carbs_g: parseInt(document.getElementById('bf-goal-carbs')?.value) || 250,
        fat_g: parseInt(document.getElementById('bf-goal-fat')?.value) || 65,
      };

      try {
        await this._apiPut('/api/brainfuel/goals', goals);
        showToast('Goals saved!', 'success');
        this._closeModal();
        this._fetchData();
      } catch (err) {
        showToast('Failed to save goals: ' + err.message, 'error');
      }
    });
  }

  // ─── Modal Helpers ──────────────────────────────────────

  _closeModal() {
    const container = document.getElementById('bf-modal-container');
    if (container) container.innerHTML = '';
    this._analysisResult = null;
    this._selectedImage = null;
  }

  // ─── Cleanup ────────────────────────────────────────────

  _cleanup() {
    this._unsubs.forEach(fn => fn());
    this._unsubs = [];
    this._closeModal();
  }
}
