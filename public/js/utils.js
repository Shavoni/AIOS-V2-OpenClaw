/**
 * AIOS V2 - Utility Functions
 * Formatting helpers, DOM shortcuts, and common utilities.
 */

/**
 * Format seconds into human-readable uptime string.
 * @param {number} seconds
 * @returns {string} e.g., "1d 2h 3m 4s"
 */
export function formatUptime(seconds) {
  if (seconds == null || isNaN(seconds)) return '0s';
  seconds = Math.floor(seconds);

  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);

  return parts.join(' ');
}

/**
 * Format a dollar amount with appropriate precision.
 * @param {number} dollars
 * @returns {string} e.g., "$0.0042" or "$12.50"
 */
export function formatCost(dollars) {
  if (dollars == null || isNaN(dollars)) return '$0.00';
  if (dollars === 0) return '$0.00';
  if (Math.abs(dollars) < 0.01) {
    return '$' + dollars.toFixed(4);
  }
  return '$' + dollars.toFixed(2);
}

/**
 * Format token count with K/M suffix.
 * @param {number} count
 * @returns {string} e.g., "12.5K", "1.2M"
 */
export function formatTokens(count) {
  if (count == null || isNaN(count)) return '0';
  if (count >= 1_000_000) {
    return (count / 1_000_000).toFixed(1) + 'M';
  }
  if (count >= 1_000) {
    return (count / 1_000).toFixed(1) + 'K';
  }
  return String(count);
}

/**
 * Format an ISO date string to a readable date.
 * @param {string} isoString
 * @returns {string} e.g., "Feb 17, 2026"
 */
export function formatDate(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

/**
 * Format an ISO date string to a readable time.
 * @param {string} isoString
 * @returns {string} e.g., "3:24 PM"
 */
export function formatTime(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

/**
 * Format an ISO date string to a relative time string.
 * @param {string} isoString
 * @returns {string} e.g., "2 min ago", "3 hours ago"
 */
export function formatRelative(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 5) return 'just now';
    if (diffSec < 60) return `${diffSec}s ago`;

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} min ago`;

    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? 's' : ''} ago`;

    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 30) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;

    const diffMon = Math.floor(diffDay / 30);
    if (diffMon < 12) return `${diffMon} month${diffMon > 1 ? 's' : ''} ago`;

    const diffYr = Math.floor(diffMon / 12);
    return `${diffYr} year${diffYr > 1 ? 's' : ''} ago`;
  } catch {
    return '';
  }
}

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (!str) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return String(str).replace(/[&<>"']/g, (c) => map[c]);
}

/**
 * Create a debounced version of a function.
 * @param {Function} fn
 * @param {number} ms - Delay in milliseconds
 * @returns {Function}
 */
export function debounce(fn, ms) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

/**
 * querySelector shorthand.
 * @param {string} selector
 * @param {Element} [parent=document]
 * @returns {Element|null}
 */
export function $(selector, parent = document) {
  return parent.querySelector(selector);
}

/**
 * querySelectorAll shorthand.
 * @param {string} selector
 * @param {Element} [parent=document]
 * @returns {NodeList}
 */
export function $$(selector, parent = document) {
  return parent.querySelectorAll(selector);
}

/**
 * Create a DOM element with optional class and innerHTML.
 * @param {string} tag - HTML tag name
 * @param {string} [className=''] - CSS class(es)
 * @param {string} [innerHTML=''] - Inner HTML content
 * @returns {HTMLElement}
 */
export function createElement(tag, className = '', innerHTML = '') {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (innerHTML) el.innerHTML = innerHTML;
  return el;
}
