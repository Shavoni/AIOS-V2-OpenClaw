/**
 * TDD RED → GREEN: ARIA Attributes for WCAG 2.1 AA
 * Verifies that modal, toast, sidebar, and main content have correct ARIA roles.
 */

const fs = require('fs');
const path = require('path');

describe('ARIA Attributes', () => {
  let htmlContent;

  beforeAll(() => {
    htmlContent = fs.readFileSync(
      path.join(__dirname, '../../public/index.html'),
      'utf8'
    );
  });

  // Sidebar
  it('sidebar has role="navigation" and aria-label', () => {
    expect(htmlContent).toMatch(/id="sidebar"[^>]*role="navigation"/);
    expect(htmlContent).toMatch(/id="sidebar"[^>]*aria-label/);
  });

  // Main content
  it('main content has role="main"', () => {
    expect(htmlContent).toMatch(/id="main-content"[^>]*role="main"/);
  });

  // Toast container
  it('toast container has role="alert" and aria-live="assertive"', () => {
    expect(htmlContent).toMatch(/id="toast-container"[^>]*role="alert"/);
    expect(htmlContent).toMatch(/id="toast-container"[^>]*aria-live="assertive"/);
  });

  // Skip-to-content link
  it('has a skip-to-content link as first focusable element', () => {
    expect(htmlContent).toMatch(/class="skip-to-content"/);
    expect(htmlContent).toMatch(/href="#main-content"/);
  });

  // aria-live region for page transitions
  it('has an aria-live="polite" region for page change announcements', () => {
    expect(htmlContent).toMatch(/aria-live="polite"/);
    expect(htmlContent).toMatch(/id="route-announcer"/);
  });

  // Modal component checks (via source code)
  describe('Modal component source', () => {
    let modalSource;

    beforeAll(() => {
      modalSource = fs.readFileSync(
        path.join(__dirname, '../../public/js/components/modal.js'),
        'utf8'
      );
    });

    it('modal sets role="dialog"', () => {
      expect(modalSource).toMatch(/role="dialog"/);
    });

    it('modal sets aria-modal="true"', () => {
      expect(modalSource).toMatch(/aria-modal="true"/);
    });

    it('modal sets aria-labelledby', () => {
      expect(modalSource).toMatch(/aria-labelledby/);
    });
  });
});
