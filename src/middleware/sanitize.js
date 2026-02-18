/**
 * XSS sanitization for chat messages.
 *
 * Strips dangerous HTML constructs (script tags, event handlers,
 * javascript: URLs, iframe/object/embed tags) while preserving
 * markdown formatting, inline code, and normal text.
 */

function sanitizeMessage(text) {
  if (typeof text !== 'string') return '';
  if (!text) return '';

  let sanitized = text;

  // Strip script tags and their content (including multiline, nested attempts)
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Strip any remaining orphaned script opening tags
  sanitized = sanitized.replace(/<script\b[^>]*>/gi, '');

  // Strip on* event handlers (onclick, onerror, onload, etc.)
  sanitized = sanitized.replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // Strip javascript: protocol URLs
  sanitized = sanitized.replace(/javascript\s*:/gi, '');

  // Neutralize iframe, object, and embed tags (replace < with &lt;)
  sanitized = sanitized.replace(/<\s*(iframe|object|embed)/gi, '&lt;$1');

  return sanitized;
}

module.exports = { sanitizeMessage };
