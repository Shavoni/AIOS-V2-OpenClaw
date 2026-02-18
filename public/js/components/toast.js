/**
 * AIOS V2 - Toast Notification System
 * Lightweight toast notifications with auto-dismiss.
 */

/**
 * Show a toast notification.
 * @param {string} message - Toast message text
 * @param {'info'|'success'|'error'} [type='info'] - Toast type
 */
export function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');

  // Create container if it doesn't exist
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconMap = {
    info: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <line x1="8" y1="7" x2="8" y2="11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="8" cy="5" r="0.75" fill="currentColor"/>
    </svg>`,
    success: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <polyline points="5,8 7,10.5 11,5.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    error: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <line x1="5.5" y1="5.5" x2="10.5" y2="10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="10.5" y1="5.5" x2="5.5" y2="10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
  };

  toast.innerHTML = `
    <span class="toast-icon">${iconMap[type] || iconMap.info}</span>
    <span class="toast-message">${escapeHtmlLight(message)}</span>
    <button class="toast-close" aria-label="Close">&times;</button>
  `;

  // Close on click
  toast.querySelector('.toast-close').addEventListener('click', () => {
    dismissToast(toast);
  });

  container.appendChild(toast);

  // Trigger enter animation
  requestAnimationFrame(() => {
    toast.classList.add('toast-enter');
  });

  // Auto-dismiss after 4 seconds
  const timer = setTimeout(() => {
    dismissToast(toast);
  }, 4000);

  // Store timer ref for cleanup
  toast._dismissTimer = timer;
}

/**
 * Dismiss a toast with exit animation.
 * @param {HTMLElement} toast
 */
function dismissToast(toast) {
  if (toast._dismissed) return;
  toast._dismissed = true;

  clearTimeout(toast._dismissTimer);
  toast.classList.add('toast-exit');

  toast.addEventListener('transitionend', () => {
    toast.remove();
  });

  // Fallback removal if transition doesn't fire
  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 500);
}

/**
 * Minimal HTML escaping for toast messages.
 * @param {string} str
 * @returns {string}
 */
function escapeHtmlLight(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
