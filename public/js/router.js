/**
 * AIOS V2 - Hash-based SPA Router
 * Handles client-side routing with hash fragments, page transitions, and nav state.
 */

export class Router {
  /**
   * @param {string} mountSelector - CSS selector for the mount element
   */
  constructor(mountSelector) {
    this._mount = document.querySelector(mountSelector);
    if (!this._mount) {
      throw new Error(`Router: mount element "${mountSelector}" not found`);
    }
    this._routes = new Map();
    this._currentCleanup = null;
    this._currentPath = null;
    this._transitioning = false;
  }

  /**
   * Register a route handler.
   * @param {string} path - Route path (e.g., '/', '/chat', '/skills')
   * @param {Function} handler - Function called with (mountEl). May return a cleanup function.
   * @returns {Router} this (for chaining)
   */
  on(path, handler) {
    this._routes.set(path, handler);
    return this;
  }

  /**
   * Start listening for hash changes and resolve the initial route.
   */
  start() {
    this._onHashChange = () => this._resolve();
    window.addEventListener('hashchange', this._onHashChange);
    this._resolve();
  }

  /**
   * Stop the router and clean up.
   */
  stop() {
    window.removeEventListener('hashchange', this._onHashChange);
    this._cleanup();
  }

  /**
   * Navigate to a path by setting the hash.
   * @param {string} path - Route path
   */
  navigate(path) {
    window.location.hash = '#' + path;
  }

  /**
   * Get the current route path.
   * @returns {string} Current hash path, defaults to '/'
   */
  currentRoute() {
    const hash = window.location.hash.slice(1);
    return hash || '/';
  }

  /**
   * Resolve the current hash to a route handler.
   * @private
   */
  async _resolve() {
    if (this._transitioning) return;

    const path = this.currentRoute();

    // Don't re-render the same route
    if (path === this._currentPath) return;

    const handler = this._routes.get(path);
    if (!handler) {
      // Try fallback to '/'
      const fallback = this._routes.get('/');
      if (fallback) {
        this.navigate('/');
      }
      return;
    }

    this._transitioning = true;

    try {
      // Fade out current content
      await this._fadeOut();

      // Run cleanup from previous page
      this._cleanup();

      // Clear mount
      this._mount.innerHTML = '';

      // Call handler and store cleanup
      this._currentPath = path;
      const cleanup = await handler(this._mount);
      if (typeof cleanup === 'function') {
        this._currentCleanup = cleanup;
      }

      // Update active nav items
      this._updateNav(path);

      // Announce page change to screen readers
      this._announceRoute(path);

      // Fade in new content
      await this._fadeIn();
    } catch (err) {
      console.error(`Router: error resolving route "${path}"`, err);
    } finally {
      this._transitioning = false;
    }
  }

  /**
   * Run the current page's cleanup function.
   * @private
   */
  _cleanup() {
    if (this._currentCleanup) {
      try {
        this._currentCleanup();
      } catch (err) {
        console.error('Router: cleanup error', err);
      }
      this._currentCleanup = null;
    }
  }

  /**
   * Fade out the mount element.
   * @private
   * @returns {Promise<void>}
   */
  _fadeOut() {
    return new Promise((resolve) => {
      if (!this._mount.children.length) {
        resolve();
        return;
      }
      this._mount.style.opacity = '0';
      this._mount.style.transition = 'opacity 150ms ease-out';
      setTimeout(resolve, 150);
    });
  }

  /**
   * Fade in the mount element.
   * @private
   * @returns {Promise<void>}
   */
  _fadeIn() {
    return new Promise((resolve) => {
      this._mount.style.opacity = '0';
      // Force reflow
      void this._mount.offsetHeight;
      this._mount.style.transition = 'opacity 200ms ease-in';
      this._mount.style.opacity = '1';
      setTimeout(resolve, 200);
    });
  }

  /**
   * Announce route change to screen readers via aria-live region.
   * @private
   * @param {string} path - Current route path
   */
  _announceRoute(path) {
    const announcer = document.getElementById('route-announcer');
    if (announcer) {
      const pageName = path === '/' ? 'Dashboard' : path.slice(1).charAt(0).toUpperCase() + path.slice(2);
      announcer.textContent = `Navigated to ${pageName} page`;
    }
  }

  /**
   * Update .active class on nav items matching the current route.
   * @private
   * @param {string} path - Current route path
   */
  _updateNav(path) {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach((item) => {
      const route = item.getAttribute('data-route');
      if (route === path) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }
}
