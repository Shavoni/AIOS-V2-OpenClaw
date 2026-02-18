/**
 * RED — Theme Tokens: Light Theme CSS Variables
 * Verifies that public/css/variables.css contains proper light theme overrides
 * while preserving the default dark theme values.
 */

const fs = require('fs');
const path = require('path');

const CSS_PATH = path.resolve(__dirname, '..', '..', 'public', 'css', 'variables.css');
let cssContent;

beforeAll(() => {
  cssContent = fs.readFileSync(CSS_PATH, 'utf-8');
});

describe('Theme Tokens — Light Theme CSS', () => {
  it('should contain a [data-theme="light"] block', () => {
    expect(cssContent).toMatch(/\[data-theme=["']light["']\]\s*\{/);
  });

  it('should override --bg-primary to a light value (not dark #0a0a0f)', () => {
    // Extract the [data-theme="light"] block
    const lightBlockMatch = cssContent.match(
      /\[data-theme=["']light["']\]\s*\{([^}]+)\}/
    );
    expect(lightBlockMatch).not.toBeNull();
    const lightBlock = lightBlockMatch[1];

    // --bg-primary must be present and NOT the dark value
    const bgPrimary = lightBlock.match(/--bg-primary:\s*([^;]+);/);
    expect(bgPrimary).not.toBeNull();
    expect(bgPrimary[1].trim()).not.toBe('#0a0a0f');
    // Should be a light color (starts with #f or #e or similar)
    expect(bgPrimary[1].trim()).toMatch(/^#[a-fA-F0-9]{6}$/);
  });

  it('should override --text-primary to a dark value (not light #e0e0e0)', () => {
    const lightBlockMatch = cssContent.match(
      /\[data-theme=["']light["']\]\s*\{([^}]+)\}/
    );
    expect(lightBlockMatch).not.toBeNull();
    const lightBlock = lightBlockMatch[1];

    const textPrimary = lightBlock.match(/--text-primary:\s*([^;]+);/);
    expect(textPrimary).not.toBeNull();
    expect(textPrimary[1].trim()).not.toBe('#e0e0e0');
    // Should be a dark color
    expect(textPrimary[1].trim()).toMatch(/^#[a-fA-F0-9]{6}$/);
  });

  it('should preserve the default :root dark values unchanged', () => {
    // Extract the :root block
    const rootBlockMatch = cssContent.match(/:root\s*\{([^}]+)\}/);
    expect(rootBlockMatch).not.toBeNull();
    const rootBlock = rootBlockMatch[1];

    // Dark defaults must still be present
    expect(rootBlock).toContain('--bg-primary: #0a0a0f');
    expect(rootBlock).toContain('--text-primary: #e0e0e0');
    expect(rootBlock).toContain('--bg-secondary: #12121a');
  });

  it('should keep accent colors (--accent-green) the same across both themes', () => {
    // :root should define --accent-green
    const rootBlockMatch = cssContent.match(/:root\s*\{([^}]+)\}/);
    expect(rootBlockMatch).not.toBeNull();
    const rootBlock = rootBlockMatch[1];

    const rootAccentGreen = rootBlock.match(/--accent-green:\s*([^;]+);/);
    expect(rootAccentGreen).not.toBeNull();
    expect(rootAccentGreen[1].trim()).toBe('#00ff88');

    // Light theme block should NOT override --accent-green
    const lightBlockMatch = cssContent.match(
      /\[data-theme=["']light["']\]\s*\{([^}]+)\}/
    );
    expect(lightBlockMatch).not.toBeNull();
    const lightBlock = lightBlockMatch[1];

    const lightAccentGreen = lightBlock.match(/--accent-green:\s*([^;]+);/);
    // accent-green should not appear in the light block at all
    expect(lightAccentGreen).toBeNull();
  });
});
