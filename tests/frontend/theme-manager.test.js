/**
 * RED — ThemeManager Class
 * Tests theme switching, persistence, and subscriber notifications.
 * Uses manual DOM/localStorage mocks (no jsdom dependency).
 */

// --- Manual mocks for browser globals ---
let mockAttributes;
let mockStorage;

beforeEach(() => {
  mockAttributes = {};
  mockStorage = {};

  // Mock document.documentElement
  global.document = {
    documentElement: {
      setAttribute: jest.fn((key, value) => {
        mockAttributes[key] = value;
      }),
      getAttribute: jest.fn((key) => mockAttributes[key] || null),
    },
  };

  // Mock localStorage
  global.localStorage = {
    getItem: jest.fn((key) => mockStorage[key] || null),
    setItem: jest.fn((key, value) => {
      mockStorage[key] = value;
    }),
    removeItem: jest.fn((key) => {
      delete mockStorage[key];
    }),
  };
});

afterEach(() => {
  delete global.document;
  delete global.localStorage;
  // Clear module cache so ThemeManager re-runs constructor logic
  jest.resetModules();
});

function loadThemeManager() {
  // Use require to get a fresh module each time (after resetModules)
  const { ThemeManager } = require('../../public/js/components/theme-manager');
  return new ThemeManager();
}

describe('ThemeManager', () => {
  it('should default to "dark" theme', () => {
    const tm = loadThemeManager();
    expect(tm.getTheme()).toBe('dark');
  });

  it('should set data-theme attribute on document.documentElement via setTheme()', () => {
    const tm = loadThemeManager();
    tm.setTheme('light');
    expect(document.documentElement.setAttribute).toHaveBeenCalledWith(
      'data-theme',
      'light'
    );
    expect(tm.getTheme()).toBe('light');
  });

  it('should toggle between dark and light', () => {
    const tm = loadThemeManager();
    expect(tm.getTheme()).toBe('dark');

    tm.toggle();
    expect(tm.getTheme()).toBe('light');

    tm.toggle();
    expect(tm.getTheme()).toBe('dark');
  });

  it('should persist theme to localStorage under key "aios-theme"', () => {
    const tm = loadThemeManager();
    tm.setTheme('light');
    expect(localStorage.setItem).toHaveBeenCalledWith('aios-theme', 'light');
  });

  it('should load saved theme from localStorage on construction', () => {
    // Pre-set localStorage before constructing
    mockStorage['aios-theme'] = 'light';
    const tm = loadThemeManager();
    expect(tm.getTheme()).toBe('light');
    expect(document.documentElement.setAttribute).toHaveBeenCalledWith(
      'data-theme',
      'light'
    );
  });

  it('should notify subscribers on theme change via subscribe(cb)', () => {
    const tm = loadThemeManager();
    const callback = jest.fn();

    tm.subscribe(callback);
    tm.setTheme('light');

    expect(callback).toHaveBeenCalledWith('light');
    expect(callback).toHaveBeenCalledTimes(1);

    tm.toggle();
    expect(callback).toHaveBeenCalledWith('dark');
    expect(callback).toHaveBeenCalledTimes(2);
  });
});
