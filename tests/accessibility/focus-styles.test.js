/**
 * TDD RED → GREEN: Focus Styles (WCAG 2.1 AA)
 * Verifies :focus-visible styles exist and accessibility CSS is linked.
 */

const fs = require('fs');
const path = require('path');

describe('Focus Styles & Screen Reader Support', () => {
  it('accessibility.css exists and contains :focus-visible styles', () => {
    const cssPath = path.join(__dirname, '../../public/css/accessibility.css');
    expect(fs.existsSync(cssPath)).toBe(true);

    const content = fs.readFileSync(cssPath, 'utf8');
    expect(content).toMatch(/:focus-visible/);
    expect(content).toMatch(/outline/);
  });

  it('accessibility.css is linked in index.html', () => {
    const html = fs.readFileSync(
      path.join(__dirname, '../../public/index.html'),
      'utf8'
    );
    expect(html).toMatch(/accessibility\.css/);
  });

  it('accessibility.css includes skip-to-content styles', () => {
    const content = fs.readFileSync(
      path.join(__dirname, '../../public/css/accessibility.css'),
      'utf8'
    );
    expect(content).toMatch(/\.skip-to-content/);
  });

  it('accessibility.css includes screen-reader-only utility', () => {
    const content = fs.readFileSync(
      path.join(__dirname, '../../public/css/accessibility.css'),
      'utf8'
    );
    expect(content).toMatch(/\.sr-only|\.visually-hidden/);
  });
});
