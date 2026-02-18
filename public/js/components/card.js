/**
 * AIOS V2 - Card Components
 * Factory functions for stat cards and provider status cards.
 */

import { escapeHtml, createElement } from '../utils.js';

/**
 * Create a stat card with glass styling.
 * @param {Object} opts
 * @param {string} opts.label - Card label
 * @param {string} opts.value - Display value
 * @param {string} [opts.color='var(--accent)'] - Accent color
 * @param {string} [opts.icon=''] - SVG icon HTML
 * @returns {HTMLElement}
 */
export function createStatCard({ label, value, color = 'var(--accent)', icon = '' }) {
  const card = createElement('div', 'stat-card glass-card');
  card.style.setProperty('--card-accent', color);

  card.innerHTML = `
    <div class="stat-card-header">
      ${icon ? `<span class="stat-card-icon" style="color: ${color}">${icon}</span>` : ''}
      <span class="stat-card-label">${escapeHtml(label)}</span>
    </div>
    <div class="stat-card-value" style="color: ${color}">${escapeHtml(String(value))}</div>
    <div class="stat-card-glow" style="background: ${color}"></div>
  `;

  return card;
}

/**
 * Create a provider status card.
 * @param {Object} opts
 * @param {string} opts.name - Provider name
 * @param {string} opts.status - 'online' | 'offline' | 'unknown'
 * @param {string[]} [opts.models=[]] - Available model names
 * @param {number} [opts.latency=0] - Average latency in ms
 * @returns {HTMLElement}
 */
export function createProviderCard({ name, status, models = [], latency = 0 }) {
  const card = createElement('div', 'provider-card glass-card');

  const statusColor =
    status === 'online'
      ? 'var(--green)'
      : status === 'offline'
        ? 'var(--red)'
        : 'var(--text-dim)';

  const statusLabel =
    status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : 'Unknown';

  const modelList = models.length
    ? models
        .slice(0, 5)
        .map((m) => `<span class="model-tag">${escapeHtml(m)}</span>`)
        .join('') + (models.length > 5 ? `<span class="model-tag more">+${models.length - 5}</span>` : '')
    : '<span class="no-models">No models loaded</span>';

  card.innerHTML = `
    <div class="provider-card-header">
      <div class="provider-name-row">
        <span class="status-dot" style="background: ${statusColor}"></span>
        <span class="provider-name">${escapeHtml(name)}</span>
      </div>
      <span class="provider-status-badge" style="color: ${statusColor}">${statusLabel}</span>
    </div>
    <div class="provider-models">${modelList}</div>
    <div class="provider-meta">
      ${latency > 0 ? `<span class="provider-latency">${latency}ms</span>` : ''}
    </div>
  `;

  return card;
}
