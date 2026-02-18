/**
 * AIOS V2 - Lightweight Markdown Renderer
 * Converts a subset of markdown to HTML.
 * Supports: headings, bold, italic, inline code, code blocks, links, lists, blockquotes, hr, line breaks.
 */

/**
 * Render markdown text to HTML string.
 * @param {string} text - Markdown source
 * @returns {string} HTML string
 */
export function renderMarkdown(text) {
  if (!text) return '';

  // Normalize line endings
  let src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Extract and replace code blocks first (to prevent inner parsing)
  const codeBlocks = [];
  src = src.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const index = codeBlocks.length;
    const langLabel = lang
      ? `<span class="code-lang">${escapeHtml(lang)}</span>`
      : '';
    codeBlocks.push(
      `<div class="code-block">${langLabel}<pre><code class="${lang ? 'language-' + escapeHtml(lang) : ''}">${escapeHtml(code.trimEnd())}</code></pre></div>`
    );
    return `\x00CB${index}\x00`;
  });

  // Extract inline code (to prevent inner parsing)
  const inlineCodes = [];
  src = src.replace(/`([^`\n]+)`/g, (_, code) => {
    const index = inlineCodes.length;
    inlineCodes.push(`<code class="inline-code">${escapeHtml(code)}</code>`);
    return `\x00IC${index}\x00`;
  });

  // Process block-level elements line by line
  const lines = src.split('\n');
  const output = [];
  let inBlockquote = false;
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Horizontal rule
    if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
      closeBlocks();
      output.push('<hr/>');
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      closeBlocks();
      const level = headingMatch[1].length;
      const content = renderInline(headingMatch[2]);
      output.push(`<h${level}>${content}</h${level}>`);
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      if (!inBlockquote) {
        output.push('<blockquote>');
        inBlockquote = true;
      }
      output.push(renderInline(line.slice(2)));
      output.push('<br/>');
      continue;
    } else if (inBlockquote) {
      output.push('</blockquote>');
      inBlockquote = false;
    }

    // Unordered list
    const listMatch = line.match(/^[-*]\s+(.+)$/);
    if (listMatch) {
      if (!inList) {
        output.push('<ul>');
        inList = true;
      }
      output.push(`<li>${renderInline(listMatch[1])}</li>`);
      continue;
    } else if (inList) {
      output.push('</ul>');
      inList = false;
    }

    // Empty line
    if (line.trim() === '') {
      closeBlocks();
      // Don't add multiple consecutive breaks
      if (output.length > 0 && output[output.length - 1] !== '<br/>') {
        output.push('<br/>');
      }
      continue;
    }

    // Code block placeholder
    const cbMatch = line.match(/\x00CB(\d+)\x00/);
    if (cbMatch) {
      closeBlocks();
      output.push(codeBlocks[parseInt(cbMatch[1])]);
      continue;
    }

    // Regular paragraph
    output.push(`<p>${renderInline(line)}</p>`);
  }

  closeBlocks();

  function closeBlocks() {
    if (inBlockquote) {
      output.push('</blockquote>');
      inBlockquote = false;
    }
    if (inList) {
      output.push('</ul>');
      inList = false;
    }
  }

  // Join and restore code blocks and inline codes
  let html = output.join('\n');

  // Restore code blocks
  html = html.replace(/\x00CB(\d+)\x00/g, (_, idx) => codeBlocks[parseInt(idx)]);

  // Restore inline codes
  html = html.replace(/\x00IC(\d+)\x00/g, (_, idx) => inlineCodes[parseInt(idx)]);

  return html;
}

/**
 * Render inline markdown elements.
 * @param {string} text
 * @returns {string}
 */
function renderInline(text) {
  if (!text) return '';

  // 1. Extract links first — preserve URLs from HTML-escaping
  const links = [];
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, linkText, url) => {
    const i = links.length;
    // Only allow safe URL schemes
    const safeUrl = /^(https?:\/\/|mailto:)/i.test(url) ? url : '#';
    links.push({ text: linkText, url: safeUrl });
    return `\x00LK${i}\x00`;
  });

  // 2. Escape HTML to prevent XSS — before applying any inline formatting
  text = escapeHtml(text);

  // 3. Bold: **text**
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // 4. Italic: *text*
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // 5. Restore links with escaped text and validated URLs
  text = text.replace(/\x00LK(\d+)\x00/g, (_, idx) => {
    const link = links[parseInt(idx)];
    return `<a href="${escapeHtml(link.url)}" target="_blank" rel="noopener">${escapeHtml(link.text)}</a>`;
  });

  return text;
}

/**
 * Escape HTML special characters.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Support both CommonJS (Node/Jest) and ES module environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderMarkdown };
}
