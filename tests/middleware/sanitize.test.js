const { sanitizeMessage } = require('../../src/middleware/sanitize');

describe('sanitizeMessage', () => {
  it('strips script tags', () => {
    expect(sanitizeMessage('<script>alert("xss")</script>')).not.toContain('<script');
  });

  it('strips script tags with attributes', () => {
    expect(sanitizeMessage('<script src="evil.js"></script>')).not.toContain('<script');
  });

  it('strips inline event handlers', () => {
    expect(sanitizeMessage('<img onerror=alert(1) src=x>')).not.toContain('onerror');
  });

  it('strips javascript: URLs', () => {
    expect(sanitizeMessage('<a href="javascript:alert(1)">click</a>')).not.toContain('javascript:');
  });

  it('strips iframe tags', () => {
    expect(sanitizeMessage('<iframe src="evil.com"></iframe>')).not.toContain('<iframe');
  });

  it('strips object and embed tags', () => {
    expect(sanitizeMessage('<object data="evil.swf"></object>')).not.toContain('<object');
    expect(sanitizeMessage('<embed src="evil.swf">')).not.toContain('<embed');
  });

  it('preserves normal text', () => {
    expect(sanitizeMessage('Hello, world!')).toBe('Hello, world!');
  });

  it('preserves markdown formatting', () => {
    const md = '**bold** _italic_ `code` [link](https://example.com)';
    expect(sanitizeMessage(md)).toBe(md);
  });

  it('preserves code blocks with angle brackets', () => {
    const code = 'Use `arr.filter(x => x > 0)` to filter';
    expect(sanitizeMessage(code)).toBe(code);
  });

  it('handles non-string input gracefully', () => {
    expect(sanitizeMessage(null)).toBe('');
    expect(sanitizeMessage(undefined)).toBe('');
    expect(sanitizeMessage(123)).toBe('');
  });

  it('handles empty string', () => {
    expect(sanitizeMessage('')).toBe('');
  });

  it('strips nested/encoded script attempts', () => {
    expect(sanitizeMessage('<scr<script>ipt>alert(1)</script>')).not.toContain('<script');
  });
});
