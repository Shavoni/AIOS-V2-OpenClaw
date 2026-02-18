/**
 * AIOS V2 - Login/Register Page (V1-Level Polish)
 * Enterprise auth UI with animated background, branded hero,
 * password visibility toggle, input validation, and smooth transitions.
 */

import { showToast } from '../components/toast.js';
import { escapeHtml, $ } from '../utils.js';

export class LoginPage {
  constructor(app) {
    this.state = app.state;
    this.api = app.api;
    this.router = app.router;
    this._mode = 'login'; // 'login' | 'register'
    this._loading = false;
  }

  render(mount) {
    const branding = this.state.get('branding') || {};
    const systemName = branding.systemName || 'AIOS V2';
    const tagline = branding.tagline || 'AI-Powered Operations System';

    mount.innerHTML = `
      <div class="page page-login">
        <!-- Animated background -->
        <div class="login-bg">
          <div class="login-bg-orb login-bg-orb--1"></div>
          <div class="login-bg-orb login-bg-orb--2"></div>
          <div class="login-bg-orb login-bg-orb--3"></div>
          <div class="login-bg-grid"></div>
        </div>

        <div class="login-wrapper">
          <!-- Left: Branding Panel -->
          <div class="login-branding">
            <div class="login-brand-content">
              <div class="login-brand-logo">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                  <defs>
                    <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" style="stop-color:#00ff88"/>
                      <stop offset="100%" style="stop-color:#00b4d8"/>
                    </linearGradient>
                  </defs>
                  <circle cx="32" cy="32" r="28" stroke="url(#logo-grad)" stroke-width="2.5" fill="none"/>
                  <circle cx="32" cy="32" r="12" fill="url(#logo-grad)" opacity="0.2"/>
                  <circle cx="32" cy="32" r="6" fill="url(#logo-grad)"/>
                  <circle cx="32" cy="16" r="3" fill="url(#logo-grad)" opacity="0.5"/>
                  <circle cx="48" cy="32" r="3" fill="url(#logo-grad)" opacity="0.5"/>
                  <circle cx="32" cy="48" r="3" fill="url(#logo-grad)" opacity="0.5"/>
                  <circle cx="16" cy="32" r="3" fill="url(#logo-grad)" opacity="0.5"/>
                </svg>
              </div>
              <h1 class="login-brand-name">${escapeHtml(systemName)}</h1>
              <p class="login-brand-tagline">${escapeHtml(tagline)}</p>

              <div class="login-features">
                <div class="login-feature">
                  <div class="login-feature-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                    </svg>
                  </div>
                  <div>
                    <div class="login-feature-title">Multi-Agent Orchestration</div>
                    <div class="login-feature-desc">Route queries to domain-specific AI agents automatically</div>
                  </div>
                </div>
                <div class="login-feature">
                  <div class="login-feature-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                  </div>
                  <div>
                    <div class="login-feature-title">Enterprise Governance</div>
                    <div class="login-feature-desc">Human-in-the-loop approvals, guardrails, and audit trails</div>
                  </div>
                </div>
                <div class="login-feature">
                  <div class="login-feature-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
                    </svg>
                  </div>
                  <div>
                    <div class="login-feature-title">Intelligent Routing</div>
                    <div class="login-feature-desc">Cost-optimized multi-provider LLM routing with fallback chains</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="login-brand-footer">
              <span>Powered by <strong>OpenClaw</strong></span>
            </div>
          </div>

          <!-- Right: Auth Form -->
          <div class="login-form-panel">
            <div class="login-form-container glass-card">
              <div class="login-form-header">
                <h2 class="login-form-title" id="login-form-title">Welcome Back</h2>
                <p class="login-form-subtitle" id="login-form-subtitle">Sign in to your account to continue</p>
              </div>

              <form class="login-form" id="login-form" novalidate>
                <div class="login-field" id="field-username">
                  <label for="login-username">Username</label>
                  <div class="login-input-wrap">
                    <svg class="login-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                    <input type="text" class="form-input" id="login-username"
                           placeholder="Enter your username" autocomplete="username" required />
                  </div>
                </div>

                <div class="login-field" id="field-password">
                  <label for="login-password">Password</label>
                  <div class="login-input-wrap">
                    <svg class="login-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    <input type="password" class="form-input" id="login-password"
                           placeholder="Enter your password" autocomplete="current-password" required />
                    <button type="button" class="login-toggle-pw" id="toggle-pw" title="Show password">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <!-- Register fields (hidden by default) -->
                <div class="login-register-fields" id="register-fields">
                  <div class="login-field">
                    <label for="login-email">Email</label>
                    <div class="login-input-wrap">
                      <svg class="login-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                        <polyline points="22,6 12,13 2,6"/>
                      </svg>
                      <input type="email" class="form-input" id="login-email"
                             placeholder="you@company.com" autocomplete="email" />
                    </div>
                  </div>
                  <div class="login-field">
                    <label for="login-display">Display Name</label>
                    <div class="login-input-wrap">
                      <svg class="login-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                      </svg>
                      <input type="text" class="form-input" id="login-display"
                             placeholder="Your display name" />
                    </div>
                  </div>
                </div>

                <div class="login-error" id="login-error"></div>

                <button type="submit" class="btn btn-primary login-submit" id="login-submit">
                  <span class="login-submit-text">Sign In</span>
                  <svg class="login-submit-spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <circle cx="12" cy="12" r="10" stroke-dasharray="31.4" stroke-dashoffset="10"/>
                  </svg>
                </button>
              </form>

              <div class="login-divider">
                <span>or</span>
              </div>

              <div class="login-toggle-mode">
                <span class="login-toggle-text" id="login-toggle-text">Don't have an account?</span>
                <button class="btn btn-ghost btn-sm" id="login-toggle-btn">Create Account</button>
              </div>

              <div class="login-dev-mode">
                <button class="btn btn-ghost btn-sm" id="login-skip-btn">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/>
                  </svg>
                  Skip to Dev Mode
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this._bindEvents(mount);
    this._animateEntrance();
    return () => {};
  }

  _animateEntrance() {
    const branding = document.querySelector('.login-branding');
    const form = document.querySelector('.login-form-panel');
    if (branding) {
      branding.style.opacity = '0';
      branding.style.transform = 'translateX(-20px)';
      requestAnimationFrame(() => {
        branding.style.transition = 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
        branding.style.opacity = '1';
        branding.style.transform = 'translateX(0)';
      });
    }
    if (form) {
      form.style.opacity = '0';
      form.style.transform = 'translateX(20px)';
      setTimeout(() => {
        form.style.transition = 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
        form.style.opacity = '1';
        form.style.transform = 'translateX(0)';
      }, 150);
    }
  }

  _bindEvents(mount) {
    const form = $('#login-form', mount);
    const toggleBtn = $('#login-toggle-btn', mount);
    const skipBtn = $('#login-skip-btn', mount);
    const togglePw = $('#toggle-pw', mount);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this._handleSubmit();
    });

    toggleBtn.addEventListener('click', () => this._toggleMode());

    skipBtn.addEventListener('click', () => {
      this.state.set('currentUser', { username: 'dev', role: 'admin', devMode: true });
      showToast('Entered Dev Mode', 'info');
      this.router.navigate('/');
    });

    // Password visibility toggle
    if (togglePw) {
      togglePw.addEventListener('click', () => {
        const pw = $('#login-password');
        if (!pw) return;
        const isPassword = pw.type === 'password';
        pw.type = isPassword ? 'text' : 'password';
        togglePw.title = isPassword ? 'Hide password' : 'Show password';
        togglePw.classList.toggle('active', isPassword);
      });
    }

    // Real-time validation
    const username = $('#login-username', mount);
    const password = $('#login-password', mount);
    if (username) {
      username.addEventListener('input', () => this._validateField('username', username.value));
    }
    if (password) {
      password.addEventListener('input', () => this._validateField('password', password.value));
    }

    // Enter key on last field submits
    if (password) {
      password.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          form.requestSubmit();
        }
      });
    }
  }

  _validateField(field, value) {
    const el = $(`#field-${field}`);
    if (!el) return;

    if (field === 'username') {
      if (value.length > 0 && value.length < 2) {
        el.classList.add('field-error');
        el.classList.remove('field-valid');
      } else if (value.length >= 2) {
        el.classList.remove('field-error');
        el.classList.add('field-valid');
      } else {
        el.classList.remove('field-error', 'field-valid');
      }
    }

    if (field === 'password') {
      if (value.length > 0 && value.length < 4) {
        el.classList.add('field-error');
        el.classList.remove('field-valid');
      } else if (value.length >= 4) {
        el.classList.remove('field-error');
        el.classList.add('field-valid');
      } else {
        el.classList.remove('field-error', 'field-valid');
      }
    }
  }

  _toggleMode() {
    this._mode = this._mode === 'login' ? 'register' : 'login';
    const isLogin = this._mode === 'login';

    const title = $('#login-form-title');
    const subtitle = $('#login-form-subtitle');
    const registerFields = $('#register-fields');
    const submitBtn = $('#login-submit');
    const submitText = submitBtn?.querySelector('.login-submit-text');
    const toggleText = $('#login-toggle-text');
    const toggleBtn = $('#login-toggle-btn');

    if (title) title.textContent = isLogin ? 'Welcome Back' : 'Create Account';
    if (subtitle) subtitle.textContent = isLogin
      ? 'Sign in to your account to continue'
      : 'Set up your new account';

    if (registerFields) {
      if (isLogin) {
        registerFields.classList.remove('register-fields--visible');
        setTimeout(() => { registerFields.style.display = 'none'; }, 300);
      } else {
        registerFields.style.display = 'block';
        requestAnimationFrame(() => registerFields.classList.add('register-fields--visible'));
      }
    }

    if (submitText) submitText.textContent = isLogin ? 'Sign In' : 'Create Account';
    if (toggleText) toggleText.textContent = isLogin ? "Don't have an account?" : 'Already have an account?';
    if (toggleBtn) toggleBtn.textContent = isLogin ? 'Create Account' : 'Sign In';
    this._hideError();
  }

  async _handleSubmit() {
    if (this._loading) return;

    const username = $('#login-username')?.value?.trim();
    const password = $('#login-password')?.value;

    if (!username || !password) {
      this._showError('Username and password are required');
      return;
    }

    if (username.length < 2) {
      this._showError('Username must be at least 2 characters');
      return;
    }

    this._setLoading(true);

    try {
      if (this._mode === 'register') {
        const email = $('#login-email')?.value?.trim() || undefined;
        const displayName = $('#login-display')?.value?.trim() || undefined;
        await this.api.register(username, password, { email, displayName });
        showToast('Account created! Signing in...', 'success');
      }

      await this.api.login(username, password);
      await this.api.checkAuthStatus();
      showToast(`Welcome back, ${escapeHtml(username)}`, 'success');
      this.router.navigate('/');
    } catch (err) {
      this._showError(err.message);
    } finally {
      this._setLoading(false);
    }
  }

  _setLoading(loading) {
    this._loading = loading;
    const btn = $('#login-submit');
    if (!btn) return;
    btn.disabled = loading;
    btn.classList.toggle('login-submit--loading', loading);
  }

  _showError(message) {
    const el = $('#login-error');
    if (!el) return;
    el.textContent = message;
    el.classList.add('login-error--visible');
    // Shake animation
    el.classList.remove('shake');
    requestAnimationFrame(() => el.classList.add('shake'));
  }

  _hideError() {
    const el = $('#login-error');
    if (el) el.classList.remove('login-error--visible', 'shake');
  }
}
