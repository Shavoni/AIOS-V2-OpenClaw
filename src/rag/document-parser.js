/**
 * DocumentParser — Unified file content extraction.
 * Extracts plain text from PDF, DOCX, HTML, CSV, JSON, YAML, XML, and text files.
 * Used by the KB upload pipeline to parse binary/structured files before chunking.
 */

const cheerio = require("cheerio");

// Optional dependencies — graceful fallback if not installed
let pdfParse, mammoth, grayMatter;
try { pdfParse = require("pdf-parse"); } catch { pdfParse = null; }
try { mammoth = require("mammoth"); } catch { mammoth = null; }
try { grayMatter = require("gray-matter"); } catch { grayMatter = null; }

const SUPPORTED_FORMATS = ["txt", "md", "pdf", "docx", "html", "csv", "json", "yaml", "yml", "xml"];

class DocumentParser {
  /**
   * Parse content into plain text.
   * @param {string|Buffer} content - Raw file content (string or Buffer for binary formats)
   * @param {string} fileType - File extension (txt, md, pdf, docx, html, csv, json, yaml, xml)
   * @param {Object} [options]
   * @param {string} [options.encoding] - "base64" to decode from base64 first
   * @returns {Promise<{ text: string, format: string, metadata: Object, error?: string }>}
   */
  async parse(content, fileType, options = {}) {
    const result = { text: "", format: fileType || "txt", metadata: {} };

    if (content == null) return result;

    // Handle base64 decoding
    if (options.encoding === "base64" && typeof content === "string") {
      content = Buffer.from(content, "base64");
      // For text formats, convert buffer to string
      if (!["pdf", "docx"].includes(fileType)) {
        content = content.toString("utf-8");
      }
    }

    // Convert buffer to string for text-based formats
    if (Buffer.isBuffer(content) && !["pdf", "docx"].includes(fileType)) {
      content = content.toString("utf-8");
    }

    const type = (fileType || "txt").toLowerCase();

    try {
      switch (type) {
        case "txt":
          result.text = typeof content === "string" ? content : "";
          break;

        case "md":
          return this._parseMarkdown(content, result);

        case "html":
          return this._parseHTML(content, result);

        case "csv":
          return this._parseCSV(content, result);

        case "json":
          return this._parseJSON(content, result);

        case "yaml":
        case "yml":
          return this._parseYAML(content, result);

        case "xml":
          return this._parseXML(content, result);

        case "pdf":
          // If content is a string (pre-extracted text), use as-is instead of binary parsing
          if (typeof content === "string" && !Buffer.isBuffer(content)) {
            result.text = content;
            return result;
          }
          return await this._parsePDF(content, result);

        case "docx":
          // If content is a string (pre-extracted text), use as-is instead of binary parsing
          if (typeof content === "string" && !Buffer.isBuffer(content)) {
            result.text = content;
            return result;
          }
          return await this._parseDOCX(content, result);

        default:
          // Unknown format — return content as-is if it's a string
          result.text = typeof content === "string" ? content : "";
          break;
      }
    } catch (err) {
      result.error = err.message;
      result.text = "";
    }

    return result;
  }

  /**
   * Parse Markdown — strips frontmatter, preserves body.
   */
  _parseMarkdown(content, result) {
    if (!content || typeof content !== "string") return result;

    if (grayMatter) {
      const parsed = grayMatter(content);
      result.text = parsed.content.trim();
      result.metadata = parsed.data || {};
    } else {
      // Manual frontmatter stripping
      const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
      if (fmMatch) {
        result.text = fmMatch[2].trim();
        // Simple key-value extraction from frontmatter
        for (const line of fmMatch[1].split("\n")) {
          const kv = line.match(/^(\w+):\s*(.+)$/);
          if (kv) result.metadata[kv[1]] = kv[2].trim();
        }
      } else {
        result.text = content;
      }
    }

    return result;
  }

  /**
   * Parse HTML — extracts text, strips scripts/styles/nav.
   */
  _parseHTML(content, result) {
    if (!content || typeof content !== "string") return result;

    const $ = cheerio.load(content);

    // Extract title
    const title = $("title").text().trim();
    if (title) result.metadata.title = title;

    // Remove non-content elements
    $("script, style, nav, header, footer, noscript, iframe, svg").remove();

    // Extract text from body (or entire doc if no body)
    const body = $("body").length ? $("body") : $.root();
    result.text = body.text().replace(/\s+/g, " ").trim();

    return result;
  }

  /**
   * Parse CSV — converts to "key: value" lines per row.
   */
  _parseCSV(content, result) {
    if (!content || typeof content !== "string") return result;

    const lines = content.split("\n").filter(l => l.trim());
    if (lines.length === 0) return result;

    const headers = lines[0].split(",").map(h => h.trim());
    const textParts = [];

    if (lines.length === 1) {
      // Only headers
      textParts.push(headers.join(", "));
    } else {
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map(v => v.trim());
        const row = headers.map((h, j) => `${h}: ${values[j] || ""}`).join(", ");
        textParts.push(row);
      }
    }

    result.text = textParts.join("\n");
    result.metadata.rowCount = lines.length - 1;
    result.metadata.columns = headers;
    return result;
  }

  /**
   * Parse JSON — pretty-print for readability.
   */
  _parseJSON(content, result) {
    if (!content || typeof content !== "string") return result;

    try {
      const data = JSON.parse(content);
      result.text = JSON.stringify(data, null, 2);
    } catch {
      result.text = content;
    }

    return result;
  }

  /**
   * Parse YAML — converts to readable key-value text.
   */
  _parseYAML(content, result) {
    if (!content || typeof content !== "string") return result;

    if (grayMatter) {
      try {
        // gray-matter can parse standalone YAML with language option
        const parsed = grayMatter(content, { language: "yaml", delimiters: ["", ""] });
        if (parsed.data && Object.keys(parsed.data).length > 0) {
          result.text = this._flattenObject(parsed.data);
        } else {
          result.text = content;
        }
      } catch {
        result.text = content;
      }
    } else {
      result.text = content;
    }

    return result;
  }

  /**
   * Parse XML — extract text nodes using cheerio.
   */
  _parseXML(content, result) {
    if (!content || typeof content !== "string") return result;

    const $ = cheerio.load(content, { xmlMode: true });
    // Remove processing instructions
    result.text = $.root().text().replace(/\s+/g, " ").trim();
    return result;
  }

  /**
   * Parse PDF — extract text using pdf-parse.
   */
  async _parsePDF(content, result) {
    if (!pdfParse) {
      result.error = "pdf-parse library not available";
      return result;
    }

    if (!Buffer.isBuffer(content)) {
      if (typeof content === "string") {
        content = Buffer.from(content);
      } else {
        result.error = "PDF content must be a Buffer";
        return result;
      }
    }

    try {
      const data = await pdfParse(content);
      result.text = data.text || "";
      result.metadata.pages = data.numpages || 0;
      result.metadata.info = data.info || {};
    } catch (err) {
      result.error = `PDF parse error: ${err.message}`;
      result.text = "";
    }

    return result;
  }

  /**
   * Parse DOCX — extract text using mammoth.
   */
  async _parseDOCX(content, result) {
    if (!mammoth) {
      result.error = "mammoth library not available";
      return result;
    }

    if (!Buffer.isBuffer(content)) {
      if (typeof content === "string") {
        content = Buffer.from(content);
      } else {
        result.error = "DOCX content must be a Buffer";
        return result;
      }
    }

    try {
      const extracted = await mammoth.extractRawText({ buffer: content });
      result.text = extracted.value || "";
    } catch (err) {
      result.error = `DOCX parse error: ${err.message}`;
      result.text = "";
    }

    return result;
  }

  /**
   * Flatten a nested object to readable text.
   */
  _flattenObject(obj, prefix = "") {
    const lines = [];
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === "object" && !Array.isArray(value)) {
        lines.push(this._flattenObject(value, fullKey));
      } else if (Array.isArray(value)) {
        lines.push(`${fullKey}: ${value.join(", ")}`);
      } else {
        lines.push(`${fullKey}: ${value}`);
      }
    }
    return lines.join("\n");
  }

  /**
   * Get list of supported file formats.
   */
  static getSupportedFormats() {
    return [...SUPPORTED_FORMATS];
  }
}

module.exports = { DocumentParser };
