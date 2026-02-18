/**
 * AIOS V2 - Tabs Component
 * Reusable tabbed interface.
 */

/**
 * Create a tab system.
 * @param {Object} opts
 * @param {Array<{id: string, label: string, badge?: number}>} opts.tabs - Tab definitions
 * @param {string} [opts.activeTab] - Initially active tab ID
 * @param {string} [opts.variant] - 'default' or 'pill'
 * @param {Function} [opts.onTabChange] - Callback (tabId) => void
 * @returns {{el: HTMLElement, setActive: Function, setBadge: Function}}
 */
export function createTabs({ tabs = [], activeTab = '', variant = 'default', onTabChange = null } = {}) {
  const container = document.createElement('div');
  container.className = variant === 'pill' ? 'tabs tabs--pill' : 'tabs';

  const active = activeTab || (tabs[0] && tabs[0].id) || '';

  tabs.forEach(tab => {
    const el = document.createElement('div');
    el.className = `tab${tab.id === active ? ' active' : ''}`;
    el.dataset.tab = tab.id;

    let html = tab.label;
    if (tab.badge != null && tab.badge > 0) {
      html += `<span class="tab-badge">${tab.badge}</span>`;
    }
    el.innerHTML = html;

    el.addEventListener('click', () => {
      container.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      el.classList.add('active');
      if (onTabChange) onTabChange(tab.id);
    });

    container.appendChild(el);
  });

  return {
    el: container,
    setActive(tabId) {
      container.querySelectorAll('.tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabId);
      });
    },
    setBadge(tabId, count) {
      const tab = container.querySelector(`.tab[data-tab="${tabId}"]`);
      if (!tab) return;
      let badge = tab.querySelector('.tab-badge');
      if (count > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'tab-badge';
          tab.appendChild(badge);
        }
        badge.textContent = count;
      } else if (badge) {
        badge.remove();
      }
    }
  };
}
