/**
 * TDD RED → GREEN: WCAG 2.1 AA Color Contrast
 * Verifies that text colors meet 4.5:1 contrast ratio against backgrounds.
 */

const fs = require('fs');
const path = require('path');

/**
 * Parse a hex color to [r, g, b] in 0-255.
 */
function parseHex(hex) {
  hex = hex.replace('#', '');
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

/**
 * Compute relative luminance per WCAG 2.1.
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function relativeLuminance([r, g, b]) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Compute contrast ratio between two colors.
 */
function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(parseHex(hex1));
  const l2 = relativeLuminance(parseHex(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('WCAG 2.1 AA Color Contrast', () => {
  let cssContent;

  beforeAll(() => {
    cssContent = fs.readFileSync(
      path.join(__dirname, '../../public/css/variables.css'),
      'utf8'
    );
  });

  function extractVar(name) {
    const match = cssContent.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
    return match ? match[1] : null;
  }

  it('--text-muted meets 4.5:1 ratio against --bg-primary', () => {
    const textMuted = extractVar('--text-muted');
    const bgPrimary = extractVar('--bg-primary');
    expect(textMuted).not.toBeNull();
    expect(bgPrimary).not.toBeNull();
    const ratio = contrastRatio(textMuted, bgPrimary);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('--text-secondary meets 4.5:1 ratio against --bg-primary', () => {
    const textSecondary = extractVar('--text-secondary');
    const bgPrimary = extractVar('--bg-primary');
    expect(textSecondary).not.toBeNull();
    expect(bgPrimary).not.toBeNull();
    const ratio = contrastRatio(textSecondary, bgPrimary);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('--text-primary meets 4.5:1 ratio against --bg-primary', () => {
    const textPrimary = extractVar('--text-primary');
    const bgPrimary = extractVar('--bg-primary');
    expect(textPrimary).not.toBeNull();
    expect(bgPrimary).not.toBeNull();
    const ratio = contrastRatio(textPrimary, bgPrimary);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('--text-muted meets 4.5:1 ratio against --bg-secondary', () => {
    const textMuted = extractVar('--text-muted');
    const bgSecondary = extractVar('--bg-secondary');
    expect(textMuted).not.toBeNull();
    expect(bgSecondary).not.toBeNull();
    const ratio = contrastRatio(textMuted, bgSecondary);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});
