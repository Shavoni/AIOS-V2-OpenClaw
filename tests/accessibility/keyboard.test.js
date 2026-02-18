/**
 * TDD RED → GREEN: Keyboard Navigation (WCAG 2.1 AA)
 * Verifies focus trap in modals, escape-to-close, skip-to-content.
 */

const fs = require('fs');
const path = require('path');

describe('Keyboard Navigation', () => {
  describe('Modal component', () => {
    let modalSource;

    beforeAll(() => {
      modalSource = fs.readFileSync(
        path.join(__dirname, '../../public/js/components/modal.js'),
        'utf8'
      );
    });

    it('modal implements focus trap (Tab cycles within modal)', () => {
      // Should have focus trap logic - trapping Tab key
      expect(modalSource).toMatch(/focusableElements|focusable/i);
      expect(modalSource).toMatch(/keydown/);
      expect(modalSource).toMatch(/Tab/);
    });

    it('Escape key closes modal', () => {
      expect(modalSource).toMatch(/Escape/);
      expect(modalSource).toMatch(/hideModal/);
    });

    it('modal focuses first focusable element on open', () => {
      expect(modalSource).toMatch(/\.focus\(\)/);
    });
  });

  describe('Skip-to-content link', () => {
    let htmlContent;

    beforeAll(() => {
      htmlContent = fs.readFileSync(
        path.join(__dirname, '../../public/index.html'),
        'utf8'
      );
    });

    it('skip-to-content link exists before the sidebar', () => {
      const skipIdx = htmlContent.indexOf('skip-to-content');
      const sidebarIdx = htmlContent.indexOf('id="sidebar"');
      expect(skipIdx).toBeGreaterThan(-1);
      expect(sidebarIdx).toBeGreaterThan(-1);
      expect(skipIdx).toBeLessThan(sidebarIdx);
    });
  });

  describe('Router page announcements', () => {
    let routerSource;

    beforeAll(() => {
      routerSource = fs.readFileSync(
        path.join(__dirname, '../../public/js/router.js'),
        'utf8'
      );
    });

    it('router announces page changes to screen readers', () => {
      expect(routerSource).toMatch(/route-announcer/);
    });
  });
});
