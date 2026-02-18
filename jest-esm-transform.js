/**
 * Minimal Jest transform for frontend ES module files.
 * Strips `export` keywords so Jest can parse them as CommonJS.
 * The source files keep their ES module syntax for the browser.
 */
module.exports = {
  process(src) {
    const code = src
      .replace(/^export\s+(function|class|const|let|var)\s/gm, '$1 ')
      .replace(/^export\s+default\s/gm, 'module.exports = ')
      .replace(/^export\s*\{[^}]*\}\s*;?\s*$/gm, '');
    return { code };
  },
};
