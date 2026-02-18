/**
 * Markdown Renderer — XSS prevention and rendering tests
 */

const { renderMarkdown } = require("../../public/js/components/markdown.js");

describe("renderMarkdown", () => {
  // --- Basic rendering ---
  test("renders headings", () => {
    expect(renderMarkdown("# Title")).toContain("<h1>Title</h1>");
    expect(renderMarkdown("## Sub")).toContain("<h2>Sub</h2>");
    expect(renderMarkdown("### Third")).toContain("<h3>Third</h3>");
  });

  test("renders bold text", () => {
    expect(renderMarkdown("**bold**")).toContain("<strong>bold</strong>");
  });

  test("renders italic text", () => {
    expect(renderMarkdown("*italic*")).toContain("<em>italic</em>");
  });

  test("renders inline code", () => {
    const html = renderMarkdown("`code here`");
    expect(html).toContain('<code class="inline-code">code here</code>');
  });

  test("renders code blocks", () => {
    const html = renderMarkdown("```js\nconsole.log('hi');\n```");
    expect(html).toContain('<div class="code-block">');
    expect(html).toContain("console.log(&#039;hi&#039;);");
  });

  test("renders safe links", () => {
    const html = renderMarkdown("[Google](https://google.com)");
    expect(html).toContain('href="https://google.com"');
    expect(html).toContain("Google</a>");
  });

  test("renders unordered lists", () => {
    const html = renderMarkdown("- item 1\n- item 2");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>item 1</li>");
    expect(html).toContain("<li>item 2</li>");
  });

  test("renders horizontal rules", () => {
    expect(renderMarkdown("---")).toContain("<hr/>");
  });

  test("renders blockquotes", () => {
    const html = renderMarkdown("> quoted text");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("quoted text");
  });

  // --- XSS prevention ---
  test("escapes HTML tags in plain text", () => {
    const html = renderMarkdown("<script>alert('xss')</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  test("escapes img onerror XSS", () => {
    const html = renderMarkdown('<img src=x onerror=alert(1)>');
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  test("escapes HTML in headings", () => {
    const html = renderMarkdown("# <script>alert(1)</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  test("escapes HTML in bold text", () => {
    const html = renderMarkdown("**<b onmouseover=alert(1)>hover</b>**");
    // The < and > are escaped, so the browser won't parse it as an HTML element
    expect(html).not.toContain("<b ");
    expect(html).toContain("&lt;b");
  });

  test("escapes HTML in list items", () => {
    const html = renderMarkdown("- <script>alert(1)</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  test("escapes HTML in blockquotes", () => {
    const html = renderMarkdown("> <div onclick=alert(1)>click</div>");
    // The < and > are escaped, so the browser won't parse it as an HTML element
    expect(html).not.toContain("<div ");
    expect(html).toContain("&lt;div");
  });

  // --- Link URL scheme validation ---
  test("blocks javascript: links", () => {
    const html = renderMarkdown("[click](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
    expect(html).toContain('href="#"');
  });

  test("blocks data: URI links", () => {
    const html = renderMarkdown("[click](data:text/html,<script>alert(1)</script>)");
    expect(html).not.toContain("data:");
    expect(html).toContain('href="#"');
  });

  test("allows https links", () => {
    const html = renderMarkdown("[safe](https://example.com)");
    expect(html).toContain('href="https://example.com"');
  });

  test("allows http links", () => {
    const html = renderMarkdown("[link](http://example.com)");
    expect(html).toContain('href="http://example.com"');
  });

  test("allows mailto links", () => {
    const html = renderMarkdown("[email](mailto:test@example.com)");
    expect(html).toContain('href="mailto:test@example.com"');
  });

  test("escapes link text to prevent XSS", () => {
    const html = renderMarkdown('[<img src=x onerror=alert(1)>](https://example.com)');
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  // --- Edge cases ---
  test("returns empty string for null/undefined", () => {
    expect(renderMarkdown(null)).toBe("");
    expect(renderMarkdown(undefined)).toBe("");
    expect(renderMarkdown("")).toBe("");
  });

  test("code blocks are not affected by XSS", () => {
    const html = renderMarkdown("```\n<script>alert(1)</script>\n```");
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });
});
