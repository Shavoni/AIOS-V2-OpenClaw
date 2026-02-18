/**
 * AIOS V2 - Toggle Switch Component
 * Reusable toggle switch for enable/disable states.
 */

/**
 * Create a toggle switch element.
 * @param {Object} opts
 * @param {boolean} opts.checked - Initial state
 * @param {string} [opts.label] - Optional label text
 * @param {string} [opts.id] - Optional ID
 * @param {Function} [opts.onChange] - Callback on toggle
 * @returns {HTMLElement}
 */
export function createToggle({ checked = false, label = '', id = '', onChange = null } = {}) {
  const wrapper = document.createElement('label');
  wrapper.className = 'toggle-switch';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  if (id) input.id = id;

  const track = document.createElement('span');
  track.className = 'toggle-track';

  wrapper.appendChild(input);
  wrapper.appendChild(track);

  if (label) {
    const labelEl = document.createElement('span');
    labelEl.className = 'toggle-label';
    labelEl.textContent = label;
    wrapper.appendChild(labelEl);
  }

  if (onChange) {
    input.addEventListener('change', () => onChange(input.checked));
  }

  wrapper.getValue = () => input.checked;
  wrapper.setValue = (v) => { input.checked = v; };

  return wrapper;
}
