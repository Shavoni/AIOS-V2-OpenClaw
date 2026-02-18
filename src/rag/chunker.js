/**
 * Document chunker for RAG pipeline.
 * Splits documents into overlapping chunks for keyword search.
 */

const DEFAULT_CHUNK_SIZE = 500;   // tokens (approx 4 chars per token)
const DEFAULT_OVERLAP = 50;       // overlap tokens between chunks

class DocumentChunker {
  constructor(options = {}) {
    this.chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE;
    this.overlap = options.overlap || DEFAULT_OVERLAP;
    this.charPerToken = 4;
  }

  /**
   * Chunk a text document into overlapping segments.
   * @param {string} text - Document text
   * @param {Object} metadata - Metadata to attach to each chunk
   * @returns {Array<{text: string, index: number, metadata: Object}>}
   */
  chunk(text, metadata = {}) {
    if (!text || typeof text !== "string") return [];

    const maxChars = this.chunkSize * this.charPerToken;
    const overlapChars = this.overlap * this.charPerToken;

    // First try to split on paragraph boundaries
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());

    const chunks = [];
    let currentChunk = "";
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      // If adding this paragraph would exceed chunk size
      if (currentChunk.length + paragraph.length > maxChars && currentChunk.length > 0) {
        chunks.push({
          text: currentChunk.trim(),
          index: chunkIndex,
          tokens: Math.ceil(currentChunk.length / this.charPerToken),
          metadata,
        });
        chunkIndex++;

        // Keep overlap from the end of current chunk
        if (overlapChars > 0 && currentChunk.length > overlapChars) {
          currentChunk = currentChunk.slice(-overlapChars) + "\n\n" + paragraph;
        } else {
          currentChunk = paragraph;
        }
      } else {
        currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
      }

      // Handle very long paragraphs by splitting on sentences
      while (currentChunk.length > maxChars) {
        const splitPoint = this._findSentenceBoundary(currentChunk, maxChars);
        chunks.push({
          text: currentChunk.slice(0, splitPoint).trim(),
          index: chunkIndex,
          tokens: Math.ceil(splitPoint / this.charPerToken),
          metadata,
        });
        chunkIndex++;
        const start = Math.max(0, splitPoint - overlapChars);
        currentChunk = currentChunk.slice(start);
      }
    }

    // Don't forget the last chunk
    if (currentChunk.trim()) {
      chunks.push({
        text: currentChunk.trim(),
        index: chunkIndex,
        tokens: Math.ceil(currentChunk.length / this.charPerToken),
        metadata,
      });
    }

    return chunks;
  }

  /**
   * Chunk markdown content, preserving heading structure.
   * @param {string} markdown
   * @param {Object} metadata
   * @returns {Array}
   */
  chunkMarkdown(markdown, metadata = {}) {
    if (!markdown) return [];

    // Split on headings
    const sections = markdown.split(/(?=^#{1,3}\s)/m);
    const chunks = [];
    let currentHeading = "";

    for (const section of sections) {
      const headingMatch = section.match(/^(#{1,3})\s+(.+)/);
      if (headingMatch) {
        currentHeading = headingMatch[2].trim();
      }

      const sectionChunks = this.chunk(section, {
        ...metadata,
        heading: currentHeading,
      });
      chunks.push(...sectionChunks);
    }

    return chunks;
  }

  _findSentenceBoundary(text, maxPos) {
    // Look backwards from maxPos for a sentence boundary
    const region = text.slice(0, maxPos);
    const lastPeriod = region.lastIndexOf(". ");
    const lastNewline = region.lastIndexOf("\n");
    const boundary = Math.max(lastPeriod, lastNewline);
    return boundary > maxPos * 0.3 ? boundary + 1 : maxPos;
  }
}

module.exports = { DocumentChunker };
