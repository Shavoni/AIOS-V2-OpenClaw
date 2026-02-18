/**
 * AIOS V2 - Dropdown Menu Component
 * Kebab/action menu for card actions.
 */

/**
 * Create a kebab menu button with dropdown.
 * @param {Object} opts
 * @param {Array<{label: string, icon?: string, onClick: Function, danger?: boolean, divider?: boolean}>} opts.items
 * @param {HTMLElement} [opts.triggerEl] - Custom trigger element (defaults to kebab icon)
 * @returns {HTMLElement}
 */
export function createDropdown({ items = [], triggerEl = null } = {}) {
  const container = document.createElement('div');
  container.className = 'dropdown';

  const trigger = triggerEl || _createKebabBtn();
  container.appendChild(trigger);

  let menu = null;
  let isOpen = false;

  function close() {
    if (menu && menu.parentNode) {
      menu.remove();
    }
    isOpen = false;
  }

  function open() {
    if (isOpen) { close(); return; }
    menu = document.createElement('div');
    menu.className = 'dropdown-menu dropdown-menu--actions';

    items.forEach(item => {
      if (item.divider) {
        const div = document.createElement('div');
        div.className = 'dropdown-divider';
        menu.appendChild(div);
        return;
      }

      const el = document.createElement('div');
      el.className = `dropdown-item${item.danger ? ' dropdown-item--danger' : ''}`;
      el.innerHTML = `${item.icon ? `<span class="dropdown-item-icon">${item.icon}</span>` : ''}${item.label}`;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        close();
        if (item.onClick) item.onClick();
      });
      menu.appendChild(el);
    });

    container.appendChild(menu);
    isOpen = true;

    // Close on outside click
    const handler = (e) => {
      if (!container.contains(e.target)) {
        close();
        document.removeEventListener('click', handler, true);
      }
    };
    setTimeout(() => document.addEventListener('click', handler, true), 0);
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    open();
  });

  container.close = close;
  return container;
}

function _createKebabBtn() {
  const btn = document.createElement('button');
  btn.className = 'kebab-btn';
  btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <circle cx="8" cy="3" r="1.5"/>
    <circle cx="8" cy="8" r="1.5"/>
    <circle cx="8" cy="13" r="1.5"/>
  </svg>`;
  btn.title = 'Actions';
  return btn;
}
