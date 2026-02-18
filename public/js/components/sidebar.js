/**
 * AIOS V2 - Sidebar Component
 * Navigation sidebar with collapse toggle, badge counts, and connection status.
 */

import { escapeHtml } from '../utils.js';
import { ThemeManager } from './theme-manager.js';

export class Sidebar {
  /**
   * @param {HTMLElement} el - Sidebar container element
   * @param {import('../router.js').Router} router - SPA router instance
   * @param {import('../state.js').State} [state] - Reactive state store
   */
  constructor(el, router, state) {
    this.el = el;
    this.router = router;
    this.state = state || null;
    this._unsubs = [];
    this._collapsed = false;
    this._themeManager = new ThemeManager();
  }

  render() {
    const navItems = [
      {
        label: 'Dashboard',
        route: '/',
        badgeKey: null,
        icon: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="2" width="7" height="7" rx="1"/>
          <rect x="11" y="2" width="7" height="7" rx="1"/>
          <rect x="2" y="11" width="7" height="7" rx="1"/>
          <rect x="11" y="11" width="7" height="7" rx="1"/>
        </svg>`,
      },
      {
        label: 'Chat',
        route: '/chat',
        badgeKey: null,
        icon: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 4h14a1 1 0 011 1v8a1 1 0 01-1 1H7l-4 3V5a1 1 0 011-1z"/>
          <line x1="7" y1="8" x2="13" y2="8"/>
          <line x1="7" y1="11" x2="11" y2="11"/>
        </svg>`,
      },
      {
        label: 'Agents',
        route: '/agents',
        badgeKey: null,
        icon: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="10" cy="6" r="4"/>
          <path d="M3 18c0-3.3 3.1-6 7-6s7 2.7 7 6"/>
        </svg>`,
      },
      {
        label: 'Skills',
        route: '/skills',
        badgeKey: null,
        icon: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M13 2H7L2 7v6l5 5h6l5-5V7l-5-5z"/>
          <circle cx="10" cy="10" r="3"/>
        </svg>`,
      },
      {
        label: 'Memory',
        route: '/memory',
        badgeKey: null,
        icon: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 2C7 2 4 4 4 7c0 2 1 3.5 2.5 4.5C5 12.5 3 14 3 16h14c0-2-2-3.5-3.5-4.5C15 10.5 16 9 16 7c0-3-3-5-6-5z"/>
          <path d="M7.5 7a2.5 2.5 0 015 0"/>
        </svg>`,
      },
      {
        label: 'Models',
        route: '/models',
        badgeKey: null,
        icon: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 14l8 4 8-4"/>
          <path d="M2 10l8 4 8-4"/>
          <path d="M2 6l8 4 8-4L10 2 2 6z"/>
        </svg>`,
      },
      {
        label: 'Approvals',
        route: '/approvals',
        badgeKey: 'pendingApprovals',
        icon: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="14" height="14" rx="2"/>
          <path d="M7 10l2 2 4-4"/>
        </svg>`,
      },
      {
        label: 'Metrics',
        route: '/metrics',
        badgeKey: null,
        icon: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="2,16 6,10 10,13 14,5 18,8"/>
          <line x1="2" y1="18" x2="18" y2="18"/>
        </svg>`,
      },
      {
        label: 'Audit',
        route: '/audit',
        badgeKey: null,
        icon: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 2l7 3v5c0 4-3 7-7 8-4-1-7-4-7-8V5l7-3z"/>
          <path d="M7 10l2 2 4-4"/>
        </svg>`,
      },
      {
        label: 'Onboarding',
        route: '/onboarding',
        badgeKey: null,
        icon: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="10" cy="10" r="8"/>
          <path d="M10 6v4l3 2"/>
          <path d="M6 14l-2 3M14 14l2 3"/>
        </svg>`,
      },
      {
        label: 'Integrations',
        route: '/integrations',
        badgeKey: null,
        icon: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 2v4M10 14v4M3.5 5.5l2.8 2.8M13.7 13.7l2.8 2.8M2 10h4M14 10h4M3.5 14.5l2.8-2.8M13.7 6.3l2.8-2.8"/>
        </svg>`,
      },
      {
        label: 'Settings',
        route: '/settings',
        badgeKey: null,
        icon: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="10" cy="10" r="3"/>
          <path d="M10 1v3M10 16v3M1 10h3M16 10h3M3.5 3.5l2 2M14.5 14.5l2 2M3.5 16.5l2-2M14.5 5.5l2-2"/>
        </svg>`,
      },
    ];

    const currentRoute = this.router.currentRoute();
    const user = this.state?.get('currentUser');
    const connected = this.state?.get('socketConnected');
    const reconnecting = this.state?.get('socketReconnecting');

    const userName = user?.displayName || user?.display_name || user?.username || 'Dev Mode';
    const userRole = user?.role || 'admin';
    const isDevMode = user?.devMode;

    let connStatusClass = 'conn-connected';
    let connStatusText = 'Connected';
    if (reconnecting) {
      connStatusClass = 'conn-reconnecting';
      connStatusText = 'Reconnecting...';
    } else if (connected === false) {
      connStatusClass = 'conn-disconnected';
      connStatusText = 'Disconnected';
    }

    this.el.innerHTML = `
      <div class="sidebar-header">
        <div class="sidebar-logo">
          <span class="logo-icon">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="12" stroke="var(--accent)" stroke-width="2"/>
              <circle cx="14" cy="14" r="6" fill="var(--accent)" opacity="0.3"/>
              <circle cx="14" cy="14" r="3" fill="var(--accent)"/>
            </svg>
          </span>
          <div class="logo-text">
            <span class="logo-title">AIOS V2</span>
            <span class="logo-version">v2.0.0</span>
          </div>
        </div>
        <button class="sidebar-collapse-btn" id="sidebar-collapse-btn" title="Toggle sidebar">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <path d="M10 3L5 8l5 5"/>
          </svg>
        </button>
      </div>

      <nav class="sidebar-nav">
        ${navItems
          .map(
            (item) => {
              const badgeCount = item.badgeKey ? (this.state?.get(item.badgeKey) || 0) : 0;
              return `
          <a class="nav-item${item.route === currentRoute ? ' active' : ''}"
             data-route="${item.route}"
             href="#${item.route}"
             title="${item.label}">
            <span class="nav-icon">${item.icon}</span>
            <span class="nav-label">${item.label}</span>
            ${badgeCount > 0 ? `<span class="nav-badge">${badgeCount}</span>` : ''}
          </a>
        `;
            }
          )
          .join('')}
      </nav>

      <div class="sidebar-footer">
        <button class="theme-toggle" id="theme-toggle" title="Toggle light/dark mode">
          <span class="theme-toggle-icon" id="theme-toggle-icon">
            ${this._themeManager.getTheme() === 'dark'
              ? '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="9" r="4"/><path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.3 3.3l1.4 1.4M13.3 13.3l1.4 1.4M3.3 14.7l1.4-1.4M13.3 4.7l1.4-1.4"/></svg>'
              : '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15.1 10.4A7 7 0 017.6 2.9 7 7 0 1015.1 10.4z"/></svg>'
            }
          </span>
          <span class="theme-toggle-label">${this._themeManager.getTheme() === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
        <div class="connection-status ${connStatusClass}" title="${connStatusText}">
          <span class="conn-dot"></span>
          <span class="conn-text">${connStatusText}</span>
        </div>
        <div class="user-badge" id="user-badge">
          <span class="user-avatar-sm">${userName.charAt(0).toUpperCase()}</span>
          <div class="user-info">
            <span class="user-name">${escapeHtml(userName)}</span>
            <span class="user-role">${isDevMode ? 'Dev Mode' : userRole}</span>
          </div>
        </div>
      </div>
    `;

    // Bind click handlers
    this.el.querySelectorAll('.nav-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const route = item.getAttribute('data-route');
        this.router.navigate(route);
      });
    });

    // Collapse toggle
    const collapseBtn = this.el.querySelector('#sidebar-collapse-btn');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', () => this._toggleCollapse());
    }

    // Theme toggle
    const themeToggle = this.el.querySelector('#theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        this._themeManager.toggle();
        this._updateThemeIcon();
      });
    }

    // Restore collapsed state
    if (localStorage.getItem('aios_sidebar_collapsed') === 'true') {
      this._toggleCollapse(true);
    }

    // Listen for state changes to re-render footer
    this._unsubs.forEach(fn => fn());
    this._unsubs = [];
    if (this.state) {
      this._unsubs.push(this.state.on('socketConnected', () => this._updateFooter()));
      this._unsubs.push(this.state.on('socketReconnecting', () => this._updateFooter()));
      this._unsubs.push(this.state.on('currentUser', () => this._updateFooter()));
      this._unsubs.push(this.state.on('pendingApprovals', () => this._updateBadges()));
    }
  }

  _toggleCollapse(force) {
    this._collapsed = force !== undefined ? force : !this._collapsed;
    const app = document.getElementById('app');

    if (this._collapsed) {
      this.el.classList.add('sidebar--collapsed');
      if (app) app.classList.add('sidebar-collapsed');
      localStorage.setItem('aios_sidebar_collapsed', 'true');
    } else {
      this.el.classList.remove('sidebar--collapsed');
      if (app) app.classList.remove('sidebar-collapsed');
      localStorage.setItem('aios_sidebar_collapsed', 'false');
    }

    const btn = this.el.querySelector('#sidebar-collapse-btn svg');
    if (btn) {
      btn.style.transform = this._collapsed ? 'rotate(180deg)' : '';
    }
  }

  _updateBadges() {
    const count = this.state?.get('pendingApprovals') || 0;
    const badge = this.el.querySelector('.nav-item[data-route="/approvals"] .nav-badge');
    if (badge) {
      if (count > 0) {
        badge.textContent = count;
        badge.style.display = '';
      } else {
        badge.style.display = 'none';
      }
    } else if (count > 0) {
      const navItem = this.el.querySelector('.nav-item[data-route="/approvals"]');
      if (navItem) {
        const b = document.createElement('span');
        b.className = 'nav-badge';
        b.textContent = count;
        navItem.appendChild(b);
      }
    }
  }

  _updateThemeIcon() {
    const iconEl = this.el.querySelector('#theme-toggle-icon');
    const labelEl = this.el.querySelector('.theme-toggle-label');
    if (!iconEl) return;

    const isDark = this._themeManager.getTheme() === 'dark';
    iconEl.innerHTML = isDark
      ? '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="9" r="4"/><path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.3 3.3l1.4 1.4M13.3 13.3l1.4 1.4M3.3 14.7l1.4-1.4M13.3 4.7l1.4-1.4"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15.1 10.4A7 7 0 017.6 2.9 7 7 0 1015.1 10.4z"/></svg>';
    if (labelEl) labelEl.textContent = isDark ? 'Light Mode' : 'Dark Mode';
  }

  _updateFooter() {
    const user = this.state?.get('currentUser');
    const connected = this.state?.get('socketConnected');
    const reconnecting = this.state?.get('socketReconnecting');

    const userName = user?.displayName || user?.display_name || user?.username || 'Dev Mode';
    const userRole = user?.role || 'admin';
    const isDevMode = user?.devMode;

    let connStatusClass = 'conn-connected';
    let connStatusText = 'Connected';
    if (reconnecting) {
      connStatusClass = 'conn-reconnecting';
      connStatusText = 'Reconnecting...';
    } else if (connected === false) {
      connStatusClass = 'conn-disconnected';
      connStatusText = 'Disconnected';
    }

    const connEl = this.el.querySelector('.connection-status');
    if (connEl) {
      connEl.className = `connection-status ${connStatusClass}`;
      connEl.title = connStatusText;
      connEl.innerHTML = `<span class="conn-dot"></span><span class="conn-text">${connStatusText}</span>`;
    }

    const badge = this.el.querySelector('.user-badge');
    if (badge) {
      badge.innerHTML = `
        <span class="user-avatar-sm">${userName.charAt(0).toUpperCase()}</span>
        <div class="user-info">
          <span class="user-name">${escapeHtml(userName)}</span>
          <span class="user-role">${isDevMode ? 'Dev Mode' : userRole}</span>
        </div>
      `;
    }
  }

}
