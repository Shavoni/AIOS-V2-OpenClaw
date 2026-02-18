/**
 * AIOS V2 - Skeleton Loader Component
 * Loading placeholder animations.
 */

/**
 * Create a skeleton loading card.
 * @param {Object} [opts]
 * @param {number} [opts.lines=3] - Number of text lines
 * @param {boolean} [opts.hasTitle=true] - Show title line
 * @param {boolean} [opts.hasAvatar=false] - Show avatar circle
 * @returns {HTMLElement}
 */
export function createSkeletonCard({ lines = 3, hasTitle = true, hasAvatar = false } = {}) {
  const card = document.createElement('div');
  card.className = 'glass-card';
  card.style.padding = 'var(--space-6)';

  let html = '';

  if (hasAvatar) {
    html += '<div style="display:flex;gap:var(--space-3);align-items:center;margin-bottom:var(--space-4)">';
    html += '<div class="skeleton skeleton-circle"></div>';
    html += '<div style="flex:1"><div class="skeleton skeleton-text" style="width:50%"></div><div class="skeleton skeleton-text--sm" style="width:30%"></div></div>';
    html += '</div>';
  }

  if (hasTitle) {
    html += '<div class="skeleton skeleton-text--lg" style="margin-bottom:var(--space-4)"></div>';
  }

  for (let i = 0; i < lines; i++) {
    const width = i === lines - 1 ? '60%' : `${80 + Math.random() * 20}%`;
    html += `<div class="skeleton skeleton-text" style="width:${width}"></div>`;
  }

  card.innerHTML = html;
  return card;
}

/**
 * Create skeleton stat cards in a grid.
 * @param {number} [count=4]
 * @returns {HTMLElement}
 */
export function createSkeletonStats(count = 4) {
  const grid = document.createElement('div');
  grid.className = 'stat-grid';

  for (let i = 0; i < count; i++) {
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.innerHTML = `
      <div class="skeleton skeleton-text--sm" style="width:40%;margin-bottom:var(--space-3)"></div>
      <div class="skeleton skeleton-text--lg" style="width:50%"></div>
    `;
    grid.appendChild(card);
  }

  return grid;
}

/**
 * Create a skeleton table.
 * @param {number} [rows=5]
 * @param {number} [cols=4]
 * @returns {HTMLElement}
 */
export function createSkeletonTable(rows = 5, cols = 4) {
  const wrapper = document.createElement('div');
  wrapper.className = 'glass-card';
  wrapper.style.padding = 'var(--space-4)';

  let html = '';
  for (let r = 0; r < rows; r++) {
    html += '<div style="display:flex;gap:var(--space-4);padding:var(--space-3) 0;border-bottom:1px solid var(--border-subtle)">';
    for (let c = 0; c < cols; c++) {
      const w = c === 0 ? '25%' : `${15 + Math.random() * 10}%`;
      html += `<div class="skeleton skeleton-text" style="width:${w}"></div>`;
    }
    html += '</div>';
  }

  wrapper.innerHTML = html;
  return wrapper;
}
