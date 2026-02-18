/**
 * AIOS V2 - Modal Component
 * Accessible overlay modal with focus trap, ARIA attributes, and keyboard navigation.
 */

/**
 * Show a modal dialog.
 * @param {Object} opts
 * @param {string} opts.title - Modal title
 * @param {string} opts.body - HTML body content
 * @param {Array<{label: string, class?: string, onClick: Function}>} [opts.actions] - Action buttons
 */
export function showModal({ title, body, actions = [] }) {
  // Remove any existing modal
  hideModal();

  // Store the element that had focus before the modal opened
  const previousFocus = document.activeElement;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-overlay';

  const modalId = 'modal-title-' + Date.now();

  const actionButtons = actions
    .map(
      (action, i) =>
        `<button class="modal-btn ${action.class || ''}" data-action-idx="${i}">${escapeHtml(action.label)}</button>`
    )
    .join('');

  overlay.innerHTML = `
    <div class="modal-container glass-card" role="dialog" aria-modal="true" aria-labelledby="${modalId}" tabindex="-1">
      <div class="modal-header">
        <h3 class="modal-title" id="${modalId}">${escapeHtml(title)}</h3>
        <button class="modal-close" aria-label="Close modal">&times;</button>
      </div>
      <div class="modal-body">${body}</div>
      ${actionButtons ? `<div class="modal-actions">${actionButtons}</div>` : ''}
    </div>
  `;

  document.body.appendChild(overlay);

  // Trigger enter animation
  requestAnimationFrame(() => {
    overlay.classList.add('modal-visible');
  });

  const container = overlay.querySelector('.modal-container');

  // Focus the first focusable element inside the modal
  const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  const focusableElements = container.querySelectorAll(focusableSelector);
  if (focusableElements.length > 0) {
    focusableElements[0].focus();
  } else {
    container.focus();
  }

  // Close button
  overlay.querySelector('.modal-close').addEventListener('click', hideModal);

  // Overlay click to close
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      hideModal();
    }
  });

  // Action button handlers
  actions.forEach((action, i) => {
    const btn = overlay.querySelector(`[data-action-idx="${i}"]`);
    if (btn && action.onClick) {
      btn.addEventListener('click', (e) => {
        action.onClick(e);
      });
    }
  });

  // Keyboard handler: Escape to close + Tab focus trap
  const keyHandler = (e) => {
    if (e.key === 'Escape') {
      hideModal();
      document.removeEventListener('keydown', keyHandler);
      // Restore focus to the element that opened the modal
      if (previousFocus && previousFocus.focus) {
        previousFocus.focus();
      }
      return;
    }

    // Focus trap: cycle Tab within the modal
    if (e.key === 'Tab') {
      const focusable = container.querySelectorAll(focusableSelector);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: if on first element, wrap to last
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: if on last element, wrap to first
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };
  document.addEventListener('keydown', keyHandler);

  // Store cleanup reference on the overlay
  overlay._keyHandler = keyHandler;
  overlay._previousFocus = previousFocus;
}

/**
 * Hide and remove the current modal.
 */
export function hideModal() {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;

  // Clean up key handler
  if (overlay._keyHandler) {
    document.removeEventListener('keydown', overlay._keyHandler);
  }

  // Restore previous focus
  if (overlay._previousFocus && overlay._previousFocus.focus) {
    overlay._previousFocus.focus();
  }

  overlay.classList.remove('modal-visible');
  overlay.classList.add('modal-exit');

  // Remove after transition
  overlay.addEventListener('transitionend', () => {
    overlay.remove();
  });

  // Fallback
  setTimeout(() => {
    if (overlay.parentNode) overlay.remove();
  }, 400);
}

/**
 * Minimal HTML escaping.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
