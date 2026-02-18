/**
 * RED — Onboarding Template Dropdown Contrast Fix
 * Verifies the template select dropdown has sufficient color contrast.
 */

const fs = require("fs");
const path = require("path");

/**
 * Parse a CSS custom property value from the CSS file content.
 * Returns the raw value string.
 */
function parseCSSVar(cssContent, varName) {
  const re = new RegExp(`${varName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*([^;]+);`);
  const match = cssContent.match(re);
  return match ? match[1].trim() : null;
}

/**
 * Compute relative luminance of a hex color per WCAG 2.1.
 */
function relativeLuminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const toLinear = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Compute WCAG contrast ratio between two hex colors.
 */
function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("Onboarding Template Dropdown Contrast", () => {
  let onboardingCSS;

  beforeAll(() => {
    const cssPath = path.join(__dirname, "../../public/css/pages/onboarding.css");
    onboardingCSS = fs.readFileSync(cssPath, "utf-8");
  });

  it("should use --text-primary for .onb-agent-template-select color", () => {
    // The CSS should reference --text-primary, not --text-secondary
    const selectRegex = /\.onb-agent-template-select\s*\{[^}]*color\s*:\s*([^;]+);/;
    const match = onboardingCSS.match(selectRegex);
    expect(match).toBeTruthy();
    expect(match[1].trim()).toBe("var(--text-primary)");
  });

  it("should have text-primary (#e0e0e0) meeting 4.5:1 against bg-surface approximation", () => {
    // --text-primary is #e0e0e0, --bg-surface is rgba(255,255,255,0.03) on --bg-primary #0a0a0f
    // Effective bg is very close to #0a0a0f ≈ #0b0b10
    const textColor = "#e0e0e0";
    const bgApprox = "#0b0b10";
    const ratio = contrastRatio(textColor, bgApprox);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("should NOT use --text-secondary for template select (too low contrast)", () => {
    const selectRegex = /\.onb-agent-template-select\s*\{[^}]*color\s*:\s*var\(--text-secondary\)/;
    expect(onboardingCSS.match(selectRegex)).toBeFalsy();
  });
});
