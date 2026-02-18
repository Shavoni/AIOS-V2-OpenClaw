/**
 * AIOS V2 - Theme Manager
 * Handles dark/light mode switching with persistence and notifications.
 */
class ThemeManager {
  constructor() {
    this._listeners = [];
    this._theme = localStorage.getItem('aios-theme') || 'dark';
    this._apply();
  }

  getTheme() {
    return this._theme;
  }

  setTheme(theme) {
    this._theme = theme;
    localStorage.setItem('aios-theme', theme);
    this._apply();
    this._notify();
  }

  toggle() {
    this.setTheme(this._theme === 'dark' ? 'light' : 'dark');
  }

  subscribe(cb) {
    this._listeners.push(cb);
    return () => {
      this._listeners = this._listeners.filter(l => l !== cb);
    };
  }

  _apply() {
    document.documentElement.setAttribute('data-theme', this._theme);
  }

  _notify() {
    this._listeners.forEach(cb => cb(this._theme));
  }
}

// Support both CommonJS (Node/Jest) and ES module environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ThemeManager };
}
